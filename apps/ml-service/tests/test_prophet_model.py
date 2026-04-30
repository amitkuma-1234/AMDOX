"""AMDOX ML Service — Tests for Prophet Model."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.models.prophet_model import ProphetDemandModel


@pytest.fixture
def sample_demand_data() -> pd.DataFrame:
    """Generate synthetic demand data for testing."""
    np.random.seed(42)
    dates = pd.date_range("2022-01-01", periods=800, freq="D")
    # Seasonal pattern + noise
    base = 100
    seasonal = 20 * np.sin(2 * np.pi * np.arange(800) / 365)
    weekly = 10 * np.sin(2 * np.pi * np.arange(800) / 7)
    noise = np.random.normal(0, 5, 800)
    demand = np.maximum(0, base + seasonal + weekly + noise)

    return pd.DataFrame({"date": dates, "demand": demand})


class TestProphetDemandModel:
    """Unit tests for Prophet demand forecasting model."""

    def test_model_creation(self):
        """Test model instantiation."""
        model = ProphetDemandModel(sku_id="TEST-001")
        assert model.sku_id == "TEST-001"
        assert model.is_trained is False
        assert model.model is None

    def test_prepare_dataframe(self, sample_demand_data: pd.DataFrame):
        """Test dataframe preparation with features."""
        model = ProphetDemandModel(sku_id="TEST-001")
        prepared = model._prepare_dataframe(sample_demand_data)

        assert "ds" in prepared.columns
        assert "y" in prepared.columns
        assert "lag_7" in prepared.columns
        assert "lag_30" in prepared.columns
        assert "rolling_avg_7" in prepared.columns
        assert len(prepared) == len(sample_demand_data)

    def test_train_model(self, sample_demand_data: pd.DataFrame):
        """Test model training and metrics calculation."""
        model = ProphetDemandModel(sku_id="TEST-001")
        metrics = model.train(sample_demand_data)

        assert model.is_trained is True
        assert "mape" in metrics
        assert "rmse" in metrics
        assert "mae" in metrics
        assert metrics["mape"] >= 0
        assert metrics["rmse"] >= 0

    def test_predict_without_training(self):
        """Test prediction fails without training."""
        model = ProphetDemandModel(sku_id="TEST-001")
        with pytest.raises(RuntimeError, match="must be trained"):
            model.predict()

    def test_predict_after_training(self, sample_demand_data: pd.DataFrame):
        """Test prediction after training."""
        model = ProphetDemandModel(sku_id="TEST-001")
        model.train(sample_demand_data)
        result = model.predict(horizon_days=30)

        assert result["sku_id"] == "TEST-001"
        assert result["horizon_days"] == 30
        assert len(result["forecast"]) == 30
        assert "predicted_demand" in result["forecast"][0]
        assert "lower_bound" in result["forecast"][0]
        assert "upper_bound" in result["forecast"][0]

    def test_serialize_deserialize(self, sample_demand_data: pd.DataFrame):
        """Test model serialization round-trip."""
        model = ProphetDemandModel(sku_id="TEST-001")
        model.train(sample_demand_data)

        # Serialize
        json_str = model.serialize()
        assert isinstance(json_str, str)
        assert len(json_str) > 0

        # Deserialize
        loaded = ProphetDemandModel.deserialize(json_str, sku_id="TEST-001")
        assert loaded.is_trained is True

    def test_calculate_metrics(self):
        """Test metric calculations."""
        actual = np.array([100, 200, 300, 400, 500])
        predicted = np.array([110, 190, 310, 380, 520])

        metrics = ProphetDemandModel._calculate_metrics(actual, predicted)
        assert metrics["mape"] > 0
        assert metrics["rmse"] > 0
        assert metrics["mae"] > 0
        assert metrics["n_samples"] == 5

    def test_non_negative_predictions(self, sample_demand_data: pd.DataFrame):
        """Test that predictions are non-negative."""
        model = ProphetDemandModel(sku_id="TEST-001")
        model.train(sample_demand_data)
        result = model.predict(horizon_days=30)

        for point in result["forecast"]:
            assert point["predicted_demand"] >= 0
            assert point["lower_bound"] >= 0
