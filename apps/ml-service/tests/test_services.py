"""AMDOX ML Service — Tests for Training & Prediction Services."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.training_service import TrainingService
from app.services.prediction_service import PredictionService


@pytest.fixture
def sample_df() -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2022-01-01", periods=800, freq="D")
    demand = np.maximum(0, 100 + np.random.normal(0, 10, 800))
    return pd.DataFrame({"date": dates, "demand": demand})


class TestTrainingService:
    """Tests for training service."""

    @pytest.mark.asyncio
    async def test_train_insufficient_data(self):
        service = TrainingService()
        service.data_loader.load_demand_data = AsyncMock(return_value=None)

        result = await service.train_sku("SKU-001")
        assert result["status"] == "insufficient_data"

    @pytest.mark.asyncio
    async def test_select_best_model(self):
        service = TrainingService()
        models = {
            "prophet": {"status": "trained", "mape": 10.5, "rmse": 5.2, "mae": 3.1},
            "lstm": {"status": "trained", "mape": 8.3, "rmse": 4.1, "mae": 2.5},
        }
        best = service._select_best_model(models)
        assert best is not None
        assert best["model_type"] == "lstm"
        assert best["mape"] == 8.3

    @pytest.mark.asyncio
    async def test_select_best_model_with_failures(self):
        service = TrainingService()
        models = {
            "prophet": {"status": "trained", "mape": 10.5, "rmse": 5.2},
            "lstm": {"status": "failed", "error": "Something broke"},
        }
        best = service._select_best_model(models)
        assert best is not None
        assert best["model_type"] == "prophet"


class TestPredictionService:
    """Tests for prediction service."""

    @pytest.mark.asyncio
    async def test_predict_no_model(self):
        service = PredictionService()
        result = await service.predict("NONEXISTENT-SKU", use_cache=False)
        assert result["status"] == "no_model"

    @pytest.mark.asyncio
    async def test_batch_exceeds_limit(self):
        service = PredictionService()
        sku_ids = [f"SKU-{i}" for i in range(1500)]
        result = await service.predict_batch(sku_ids)
        assert result["status"] == "error"
        assert "exceeds" in result["message"]

    def test_cache_key_format(self):
        service = PredictionService()
        key = service._cache_key("SKU-001", 90)
        assert key == "amdox:forecast:SKU-001:h90"

    def test_clear_model_cache(self):
        service = PredictionService()
        service._loaded_models["test"] = "model"
        service.clear_model_cache()
        assert len(service._loaded_models) == 0


class TestIntegration:
    """Integration test: train model then make prediction."""

    @pytest.mark.asyncio
    async def test_train_and_predict_prophet(self, sample_df):
        """End-to-end: train Prophet and predict."""
        from app.models.prophet_model import ProphetDemandModel

        # Train
        model = ProphetDemandModel(sku_id="INT-TEST-001")
        metrics = model.train(sample_df)
        assert metrics["mape"] >= 0

        # Predict
        forecast = model.predict(horizon_days=30)
        assert len(forecast["forecast"]) == 30
        assert all(p["predicted_demand"] >= 0 for p in forecast["forecast"])
