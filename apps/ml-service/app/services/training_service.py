"""AMDOX ML Service — Training Service."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.config import get_settings
from app.models.lstm_model import LSTMDemandModel
from app.models.model_registry import ModelRegistry
from app.models.prophet_model import ProphetDemandModel
from app.utils.data_loader import DataLoader

logger = logging.getLogger(__name__)


class TrainingService:
    """Orchestrates model training pipeline.

    Pipeline:
    1. Fetch demand data from Postgres
    2. Feature engineering (lag features, rolling averages, seasonality)
    3. Time-series aware train/test split (80/20)
    4. Train Prophet and LSTM models
    5. Validate with MAPE, RMSE, MAE
    6. Log to MLflow, register best model
    7. Alert if accuracy degrades > 15%
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.data_loader = DataLoader()
        self.registry = ModelRegistry()

    async def train_sku(
        self,
        sku_id: str,
        model_type: str = "auto",
        force: bool = False,
    ) -> dict[str, Any]:
        """Train demand forecasting model for a single SKU.

        Args:
            sku_id: SKU identifier.
            model_type: 'prophet', 'lstm', or 'auto' (trains both, picks best).
            force: Force retraining even if recent model exists.

        Returns:
            Training result with metrics and model info.
        """
        logger.info(f"Starting training pipeline for SKU {sku_id}, type={model_type}")

        # 1. Fetch demand data
        df = await self.data_loader.load_demand_data(sku_id)
        if df is None or len(df) < self.settings.min_training_days:
            available = len(df) if df is not None else 0
            return {
                "sku_id": sku_id,
                "status": "insufficient_data",
                "message": f"Need {self.settings.min_training_days} days, got {available}",
                "data_points": available,
            }

        results: dict[str, Any] = {
            "sku_id": sku_id,
            "data_points": len(df),
            "models": {},
        }

        # 2. Train models based on type
        if model_type in ("auto", "prophet"):
            try:
                prophet_result = await self._train_prophet(sku_id, df)
                results["models"]["prophet"] = prophet_result
            except Exception as e:
                logger.error(f"Prophet training failed for {sku_id}: {e}")
                results["models"]["prophet"] = {"status": "failed", "error": str(e)}

        if model_type in ("auto", "lstm"):
            try:
                lstm_result = await self._train_lstm(sku_id, df)
                results["models"]["lstm"] = lstm_result
            except Exception as e:
                logger.error(f"LSTM training failed for {sku_id}: {e}")
                results["models"]["lstm"] = {"status": "failed", "error": str(e)}

        # 3. Select best model
        best_model = self._select_best_model(results["models"])
        results["best_model"] = best_model

        # 4. Check for accuracy degradation
        if best_model and best_model.get("mape", 999) > self.settings.mape_alert_threshold:
            results["alert"] = {
                "type": "accuracy_degradation",
                "message": (
                    f"MAPE {best_model['mape']:.2f}% exceeds threshold "
                    f"{self.settings.mape_alert_threshold}%"
                ),
                "severity": "warning",
            }
            logger.warning(f"Accuracy alert for SKU {sku_id}: MAPE={best_model['mape']:.2f}%")

        results["status"] = "completed"
        results["trained_at"] = datetime.utcnow().isoformat()
        return results

    async def train_batch(
        self,
        sku_ids: list[str] | None = None,
        model_type: str = "auto",
    ) -> dict[str, Any]:
        """Train models for multiple SKUs.

        Args:
            sku_ids: List of SKU IDs. If None, trains for all active SKUs.
            model_type: Model type to train.

        Returns:
            Batch training results.
        """
        if sku_ids is None:
            sku_ids = await self.data_loader.get_active_sku_ids()

        logger.info(f"Starting batch training for {len(sku_ids)} SKUs")

        results = {
            "total_skus": len(sku_ids),
            "completed": 0,
            "failed": 0,
            "skipped": 0,
            "alerts": [],
            "details": [],
        }

        for sku_id in sku_ids:
            try:
                result = await self.train_sku(sku_id, model_type)
                results["details"].append(result)

                if result["status"] == "completed":
                    results["completed"] += 1
                elif result["status"] == "insufficient_data":
                    results["skipped"] += 1
                else:
                    results["failed"] += 1

                if "alert" in result:
                    results["alerts"].append(result["alert"])

            except Exception as e:
                logger.error(f"Batch training failed for SKU {sku_id}: {e}")
                results["failed"] += 1
                results["details"].append({
                    "sku_id": sku_id,
                    "status": "failed",
                    "error": str(e),
                })

        results["trained_at"] = datetime.utcnow().isoformat()
        logger.info(
            f"Batch training complete: {results['completed']} completed, "
            f"{results['failed']} failed, {results['skipped']} skipped"
        )
        return results

    async def _train_prophet(self, sku_id: str, df: Any) -> dict[str, Any]:
        """Train Prophet model for a SKU."""
        model = ProphetDemandModel(sku_id=sku_id)
        metrics = model.train(df)

        # Save model artifact
        artifact_path = self.settings.artifacts_dir / f"prophet_{sku_id}.json"
        model_json = model.serialize()
        artifact_path.write_text(model_json)

        # Log to MLflow
        run_id = self.registry.log_training_run(
            sku_id=sku_id,
            model_type="prophet",
            params={
                "changepoint_prior_scale": self.settings.prophet_changepoint_prior_scale,
                "seasonality_prior_scale": self.settings.prophet_seasonality_prior_scale,
                "forecast_horizon": self.settings.prophet_forecast_horizon,
                "country_holidays": self.settings.prophet_country_holidays,
            },
            metrics=metrics,
            artifacts={"model": str(artifact_path)},
        )

        return {
            "model_type": "prophet",
            "status": "trained",
            "run_id": run_id,
            "artifact_path": str(artifact_path),
            **metrics,
        }

    async def _train_lstm(self, sku_id: str, df: Any) -> dict[str, Any]:
        """Train LSTM model for a SKU."""
        model = LSTMDemandModel(sku_id=sku_id)
        metrics = model.train(df)

        # Save model artifact
        artifact_path = self.settings.artifacts_dir / f"lstm_{sku_id}.pt"
        model.save(str(artifact_path))

        # Log to MLflow
        run_id = self.registry.log_training_run(
            sku_id=sku_id,
            model_type="lstm",
            params={
                "hidden_size": self.settings.lstm_hidden_size,
                "num_layers": self.settings.lstm_num_layers,
                "dropout": self.settings.lstm_dropout,
                "learning_rate": self.settings.lstm_learning_rate,
                "sequence_length": self.settings.lstm_sequence_length,
                "forecast_horizon": self.settings.lstm_forecast_horizon,
                "bidirectional": self.settings.lstm_bidirectional,
                "use_attention": self.settings.lstm_use_attention,
            },
            metrics=metrics,
            artifacts={"model": str(artifact_path)},
        )

        return {
            "model_type": "lstm",
            "status": "trained",
            "run_id": run_id,
            "artifact_path": str(artifact_path),
            **metrics,
        }

    def _select_best_model(self, models: dict[str, Any]) -> dict[str, Any] | None:
        """Select the best model based on MAPE."""
        best = None
        best_mape = float("inf")

        for model_type, result in models.items():
            if isinstance(result, dict) and result.get("status") == "trained":
                mape = result.get("mape", float("inf"))
                if mape < best_mape:
                    best_mape = mape
                    best = {
                        "model_type": model_type,
                        "mape": mape,
                        "rmse": result.get("rmse", 0),
                        "mae": result.get("mae", 0),
                        "run_id": result.get("run_id"),
                    }

        return best
