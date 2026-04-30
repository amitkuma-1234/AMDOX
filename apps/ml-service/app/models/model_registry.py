"""AMDOX ML Service — Model Registry (MLflow Integration)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import mlflow
import mlflow.pyfunc
from mlflow.tracking import MlflowClient

from app.config import get_settings

logger = logging.getLogger(__name__)


class ModelRegistry:
    """MLflow-backed model registry for demand forecasting models.

    Features:
    - Log metrics, parameters, and artifacts
    - Model versioning with staging/production stages
    - Auto-select best model per SKU based on MAPE
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: MlflowClient | None = None
        self._setup_mlflow()

    def _setup_mlflow(self) -> None:
        """Initialize MLflow tracking."""
        try:
            mlflow.set_tracking_uri(self.settings.mlflow_tracking_uri)
            mlflow.set_experiment(self.settings.mlflow_experiment_name)
            self._client = MlflowClient(self.settings.mlflow_tracking_uri)
            logger.info(f"MLflow tracking URI: {self.settings.mlflow_tracking_uri}")
        except Exception as e:
            logger.warning(f"Failed to initialize MLflow: {e}. Running without tracking.")
            self._client = None

    @property
    def client(self) -> MlflowClient | None:
        return self._client

    def log_training_run(
        self,
        sku_id: str,
        model_type: str,
        params: dict[str, Any],
        metrics: dict[str, float],
        artifacts: dict[str, str] | None = None,
        tags: dict[str, str] | None = None,
    ) -> str | None:
        """Log a training run to MLflow.

        Args:
            sku_id: SKU identifier.
            model_type: 'prophet' or 'lstm'.
            params: Training hyperparameters.
            metrics: Model evaluation metrics.
            artifacts: Dict of {name: file_path} to log.
            tags: Additional tags.

        Returns:
            Run ID if successful, None otherwise.
        """
        try:
            with mlflow.start_run(run_name=f"{model_type}_{sku_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}") as run:
                # Log parameters
                mlflow.log_params({
                    "sku_id": sku_id,
                    "model_type": model_type,
                    **{k: str(v) for k, v in params.items()},
                })

                # Log metrics
                mlflow.log_metrics(metrics)

                # Log artifacts
                if artifacts:
                    for name, path in artifacts.items():
                        mlflow.log_artifact(path, artifact_path=name)

                # Set tags
                all_tags = {
                    "sku_id": sku_id,
                    "model_type": model_type,
                    "trained_at": datetime.utcnow().isoformat(),
                }
                if tags:
                    all_tags.update(tags)
                mlflow.set_tags(all_tags)

                logger.info(f"Logged training run {run.info.run_id} for {model_type}/{sku_id}")
                return run.info.run_id

        except Exception as e:
            logger.error(f"Failed to log training run: {e}")
            return None

    def register_model(
        self,
        run_id: str,
        model_name: str,
        model_type: str,
        stage: str = "Staging",
    ) -> int | None:
        """Register a model version in the MLflow Model Registry.

        Args:
            run_id: MLflow run ID containing the model.
            model_name: Registry name (e.g., 'demand-forecast-SKU001').
            model_type: 'prophet' or 'lstm'.
            stage: Model stage ('Staging', 'Production', 'Archived').

        Returns:
            Model version number if successful, None otherwise.
        """
        if self._client is None:
            logger.warning("MLflow client not available, skipping registration")
            return None

        try:
            # Create registered model if it doesn't exist
            try:
                self._client.create_registered_model(model_name)
            except Exception:
                pass  # Model already exists

            # Create model version
            model_uri = f"runs:/{run_id}/model"
            mv = self._client.create_model_version(
                name=model_name,
                source=model_uri,
                run_id=run_id,
                tags={"model_type": model_type},
            )

            # Transition to desired stage
            self._client.transition_model_version_stage(
                name=model_name,
                version=mv.version,
                stage=stage,
            )

            logger.info(
                f"Registered model {model_name} v{mv.version} in stage '{stage}'"
            )
            return int(mv.version)

        except Exception as e:
            logger.error(f"Failed to register model: {e}")
            return None

    def get_best_model_for_sku(self, sku_id: str) -> dict[str, Any] | None:
        """Find the best model for a SKU based on MAPE metric.

        Args:
            sku_id: SKU identifier.

        Returns:
            Dictionary with model info or None if not found.
        """
        if self._client is None:
            return None

        try:
            experiment = mlflow.get_experiment_by_name(self.settings.mlflow_experiment_name)
            if experiment is None:
                return None

            # Search for runs for this SKU, sorted by MAPE
            runs = self._client.search_runs(
                experiment_ids=[experiment.experiment_id],
                filter_string=f"tags.sku_id = '{sku_id}'",
                order_by=["metrics.mape ASC"],
                max_results=1,
            )

            if not runs:
                return None

            best_run = runs[0]
            return {
                "run_id": best_run.info.run_id,
                "model_type": best_run.data.tags.get("model_type", "unknown"),
                "mape": best_run.data.metrics.get("mape", 999.0),
                "rmse": best_run.data.metrics.get("rmse", 999.0),
                "mae": best_run.data.metrics.get("mae", 999.0),
                "trained_at": best_run.data.tags.get("trained_at", ""),
                "params": dict(best_run.data.params),
            }

        except Exception as e:
            logger.error(f"Failed to find best model for SKU {sku_id}: {e}")
            return None

    def list_models(self) -> list[dict[str, Any]]:
        """List all registered models with their versions.

        Returns:
            List of model info dictionaries.
        """
        if self._client is None:
            return []

        try:
            registered_models = self._client.search_registered_models()
            result = []

            for rm in registered_models:
                versions = self._client.search_model_versions(f"name='{rm.name}'")
                for v in versions:
                    result.append({
                        "name": rm.name,
                        "version": v.version,
                        "stage": v.current_stage,
                        "status": v.status,
                        "run_id": v.run_id,
                        "created_at": v.creation_timestamp,
                        "tags": dict(v.tags) if v.tags else {},
                    })

            return result

        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    def promote_to_production(self, model_name: str, version: int) -> bool:
        """Promote a model version to production.

        Args:
            model_name: Registered model name.
            version: Version number to promote.

        Returns:
            True if successful.
        """
        if self._client is None:
            return False

        try:
            # Archive current production version
            current_prod = self._client.get_latest_versions(
                model_name, stages=["Production"]
            )
            for mv in current_prod:
                self._client.transition_model_version_stage(
                    name=model_name,
                    version=mv.version,
                    stage="Archived",
                )

            # Promote new version
            self._client.transition_model_version_stage(
                name=model_name,
                version=str(version),
                stage="Production",
            )
            logger.info(f"Promoted {model_name} v{version} to Production")
            return True

        except Exception as e:
            logger.error(f"Failed to promote model: {e}")
            return False

    def get_metrics_summary(self) -> list[dict[str, Any]]:
        """Get metrics summary for all tracked models.

        Returns:
            List of metric summaries per SKU.
        """
        if self._client is None:
            return []

        try:
            experiment = mlflow.get_experiment_by_name(self.settings.mlflow_experiment_name)
            if experiment is None:
                return []

            runs = self._client.search_runs(
                experiment_ids=[experiment.experiment_id],
                order_by=["metrics.mape ASC"],
                max_results=100,
            )

            summaries = {}
            for run in runs:
                sku_id = run.data.tags.get("sku_id", "unknown")
                if sku_id not in summaries:
                    summaries[sku_id] = {
                        "sku_id": sku_id,
                        "best_model_type": run.data.tags.get("model_type", "unknown"),
                        "best_mape": run.data.metrics.get("mape", 999.0),
                        "best_rmse": run.data.metrics.get("rmse", 999.0),
                        "best_mae": run.data.metrics.get("mae", 999.0),
                        "total_runs": 0,
                        "last_trained": run.data.tags.get("trained_at", ""),
                    }
                summaries[sku_id]["total_runs"] += 1

            return list(summaries.values())

        except Exception as e:
            logger.error(f"Failed to get metrics summary: {e}")
            return []
