"""AMDOX ML Service — Prophet Demand Forecasting Model."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from prophet import Prophet
from prophet.serialize import model_from_json, model_to_json

from app.config import get_settings

logger = logging.getLogger(__name__)


class ProphetDemandModel:
    """SKU-level demand forecasting using Facebook Prophet.

    Features:
    - 90-day forecast horizon with confidence intervals
    - Seasonal decomposition (yearly, weekly)
    - Holiday calendar support (configurable country)
    - Target MAPE < 12%
    """

    def __init__(self, sku_id: str | None = None) -> None:
        self.sku_id = sku_id
        self.model: Prophet | None = None
        self.settings = get_settings()
        self.is_trained = False
        self.metrics: dict[str, float] = {}

    def _create_model(self) -> Prophet:
        """Create a new Prophet model with configured hyperparameters."""
        import holidays as holidays_lib

        model = Prophet(
            changepoint_prior_scale=self.settings.prophet_changepoint_prior_scale,
            seasonality_prior_scale=self.settings.prophet_seasonality_prior_scale,
            holidays_prior_scale=self.settings.prophet_holidays_prior_scale,
            yearly_seasonality=self.settings.prophet_yearly_seasonality,
            weekly_seasonality=self.settings.prophet_weekly_seasonality,
            daily_seasonality=self.settings.prophet_daily_seasonality,
            interval_width=0.95,
            uncertainty_samples=1000,
        )

        # Add country holidays
        try:
            country = self.settings.prophet_country_holidays
            model.add_country_holidays(country_name=country)
            logger.info(f"Added {country} holidays to Prophet model for SKU {self.sku_id}")
        except Exception as e:
            logger.warning(f"Failed to add holidays: {e}")

        # Add custom regressors for lag features
        for lag in self.settings.lag_features:
            model.add_regressor(f"lag_{lag}", standardize=True)

        # Add rolling average regressors
        for window in self.settings.rolling_windows:
            model.add_regressor(f"rolling_avg_{window}", standardize=True)

        return model

    def _prepare_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare DataFrame for Prophet (requires 'ds' and 'y' columns).

        Args:
            df: DataFrame with 'date' and 'demand' columns.

        Returns:
            Prophet-formatted DataFrame with regressors.
        """
        prophet_df = pd.DataFrame()
        prophet_df["ds"] = pd.to_datetime(df["date"])
        prophet_df["y"] = df["demand"].astype(float)

        # Sort by date
        prophet_df = prophet_df.sort_values("ds").reset_index(drop=True)

        # Add lag features
        for lag in self.settings.lag_features:
            prophet_df[f"lag_{lag}"] = prophet_df["y"].shift(lag)

        # Add rolling averages
        for window in self.settings.rolling_windows:
            prophet_df[f"rolling_avg_{window}"] = (
                prophet_df["y"].rolling(window=window, min_periods=1).mean()
            )

        # Fill NaN values from shifts/rolling with forward fill then 0
        prophet_df = prophet_df.ffill().fillna(0)

        return prophet_df

    def train(self, df: pd.DataFrame) -> dict[str, float]:
        """Train the Prophet model on historical demand data.

        Args:
            df: DataFrame with 'date' and 'demand' columns.

        Returns:
            Dictionary of training metrics (MAPE, RMSE, MAE).
        """
        logger.info(f"Training Prophet model for SKU {self.sku_id}, {len(df)} data points")

        prophet_df = self._prepare_dataframe(df)

        # Time-series aware train/test split
        split_idx = int(len(prophet_df) * self.settings.train_test_split_ratio)
        train_df = prophet_df.iloc[:split_idx]
        test_df = prophet_df.iloc[split_idx:]

        # Create and fit model
        self.model = self._create_model()
        self.model.fit(train_df)

        # Validate on test set
        if len(test_df) > 0:
            future = self.model.make_future_dataframe(periods=len(test_df))

            # Add regressor values for future periods
            for lag in self.settings.lag_features:
                future[f"lag_{lag}"] = prophet_df[f"lag_{lag}"].reindex(future.index).ffill().fillna(0)
            for window in self.settings.rolling_windows:
                future[f"rolling_avg_{window}"] = (
                    prophet_df[f"rolling_avg_{window}"].reindex(future.index).ffill().fillna(0)
                )

            forecast = self.model.predict(future)
            predicted = forecast.iloc[split_idx:]["yhat"].values
            actual = test_df["y"].values

            # Calculate metrics
            self.metrics = self._calculate_metrics(actual, predicted)
            logger.info(
                f"Prophet model metrics for SKU {self.sku_id}: "
                f"MAPE={self.metrics['mape']:.2f}%, "
                f"RMSE={self.metrics['rmse']:.4f}, "
                f"MAE={self.metrics['mae']:.4f}"
            )

        self.is_trained = True
        return self.metrics

    def predict(self, horizon_days: int | None = None) -> dict[str, Any]:
        """Generate demand forecast.

        Args:
            horizon_days: Number of days to forecast (default: from config).

        Returns:
            Dictionary with forecast data including confidence intervals.
        """
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be trained before prediction")

        horizon = horizon_days or self.settings.prophet_forecast_horizon

        future = self.model.make_future_dataframe(periods=horizon)

        # Fill regressor columns for future dates
        for lag in self.settings.lag_features:
            if f"lag_{lag}" not in future.columns:
                future[f"lag_{lag}"] = 0.0
        for window in self.settings.rolling_windows:
            if f"rolling_avg_{window}" not in future.columns:
                future[f"rolling_avg_{window}"] = 0.0

        forecast = self.model.predict(future)

        # Extract only future predictions
        future_forecast = forecast.iloc[-horizon:]

        return {
            "sku_id": self.sku_id,
            "horizon_days": horizon,
            "forecast": [
                {
                    "date": row["ds"].isoformat(),
                    "predicted_demand": round(max(0, row["yhat"]), 2),
                    "lower_bound": round(max(0, row["yhat_lower"]), 2),
                    "upper_bound": round(max(0, row["yhat_upper"]), 2),
                }
                for _, row in future_forecast.iterrows()
            ],
            "seasonal_components": {
                "yearly": forecast["yearly"].iloc[-horizon:].mean() if "yearly" in forecast else 0,
                "weekly": forecast["weekly"].iloc[-horizon:].mean() if "weekly" in forecast else 0,
            },
            "metrics": self.metrics,
        }

    def get_seasonal_decomposition(self) -> dict[str, Any]:
        """Get seasonal decomposition components."""
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be trained before decomposition")

        components = {}
        if self.settings.prophet_yearly_seasonality:
            yearly = self.model.plot_yearly()
            components["yearly"] = "available"
        if self.settings.prophet_weekly_seasonality:
            weekly = self.model.plot_weekly()
            components["weekly"] = "available"

        return components

    def serialize(self) -> str:
        """Serialize model to JSON string."""
        if self.model is None:
            raise RuntimeError("No model to serialize")
        return model_to_json(self.model)

    @classmethod
    def deserialize(cls, json_str: str, sku_id: str | None = None) -> ProphetDemandModel:
        """Deserialize model from JSON string."""
        instance = cls(sku_id=sku_id)
        instance.model = model_from_json(json_str)
        instance.is_trained = True
        return instance

    @staticmethod
    def _calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
        """Calculate forecast accuracy metrics.

        Returns:
            Dictionary with MAPE, RMSE, MAE.
        """
        # Avoid division by zero in MAPE
        mask = actual != 0
        if mask.sum() > 0:
            mape = float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)
        else:
            mape = 0.0

        rmse = float(np.sqrt(np.mean((actual - predicted) ** 2)))
        mae = float(np.mean(np.abs(actual - predicted)))

        return {
            "mape": round(mape, 4),
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "n_samples": len(actual),
        }
