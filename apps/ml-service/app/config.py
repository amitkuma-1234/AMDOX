"""AMDOX ML Service — Configuration."""

from __future__ import annotations

import os
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Environment(str, Enum):
    """Application environment."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Application ──────────────────────────────────────────
    app_name: str = "AMDOX ML Service"
    app_version: str = "1.0.0"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = True
    log_level: str = "INFO"
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 2

    # ── Database (PostgreSQL — read demand data) ─────────────
    database_url: str = Field(
        default="postgresql://amdox:amdox_secret@localhost:5432/amdox",
        description="PostgreSQL connection string for reading inventory/demand data",
    )

    # ── Redis (prediction caching) ───────────────────────────
    redis_url: str = Field(
        default="redis://:amdox_redis_secret@localhost:6379/0",
        description="Redis connection for caching predictions",
    )
    prediction_cache_ttl: int = Field(
        default=86400,  # 24 hours
        description="TTL for cached predictions in seconds",
    )

    # ── MLflow ───────────────────────────────────────────────
    mlflow_tracking_uri: str = Field(
        default="http://localhost:5000",
        description="MLflow tracking server URI",
    )
    mlflow_experiment_name: str = "amdox-demand-forecasting"

    # ── Model Paths ──────────────────────────────────────────
    artifacts_dir: Path = Field(
        default=Path("./artifacts"),
        description="Directory for model artifacts",
    )

    # ── Prophet Hyperparameters ──────────────────────────────
    prophet_forecast_horizon: int = 90  # days
    prophet_changepoint_prior_scale: float = 0.05
    prophet_seasonality_prior_scale: float = 10.0
    prophet_holidays_prior_scale: float = 10.0
    prophet_yearly_seasonality: bool = True
    prophet_weekly_seasonality: bool = True
    prophet_daily_seasonality: bool = False
    prophet_country_holidays: str = "US"

    # ── LSTM Hyperparameters ─────────────────────────────────
    lstm_sequence_length: int = 30  # days lookback
    lstm_forecast_horizon: int = 90  # days
    lstm_hidden_size: int = 128
    lstm_num_layers: int = 2
    lstm_dropout: float = 0.2
    lstm_learning_rate: float = 0.001
    lstm_epochs: int = 100
    lstm_batch_size: int = 32
    lstm_bidirectional: bool = True
    lstm_use_attention: bool = True
    lstm_early_stopping_patience: int = 10

    # ── Training Pipeline ────────────────────────────────────
    train_test_split_ratio: float = 0.8
    min_training_days: int = 365 * 2  # 2 years minimum
    mape_alert_threshold: float = 15.0  # Alert if MAPE > 15%
    target_mape: float = 12.0  # Target MAPE < 12%
    max_batch_size: int = 1000  # Max SKUs per batch prediction

    # ── Feature Engineering ──────────────────────────────────
    lag_features: list[int] = Field(default=[7, 14, 30, 60, 90])
    rolling_windows: list[int] = Field(default=[7, 14, 30])

    @field_validator("artifacts_dir")
    @classmethod
    def ensure_artifacts_dir(cls, v: Path) -> Path:
        """Create artifacts directory if it doesn't exist."""
        v.mkdir(parents=True, exist_ok=True)
        return v

    model_config = {
        "env_prefix": "ML_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get cached settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
