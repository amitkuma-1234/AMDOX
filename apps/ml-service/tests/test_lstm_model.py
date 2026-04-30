"""AMDOX ML Service — Tests for LSTM Model."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.models.lstm_model import BiLSTMAttention, LSTMDemandModel, TimeSeriesDataset


@pytest.fixture
def sample_demand_data() -> pd.DataFrame:
    """Generate synthetic demand data for testing."""
    np.random.seed(42)
    dates = pd.date_range("2022-01-01", periods=800, freq="D")
    base = 100
    seasonal = 20 * np.sin(2 * np.pi * np.arange(800) / 365)
    noise = np.random.normal(0, 5, 800)
    demand = np.maximum(0, base + seasonal + noise)
    return pd.DataFrame({"date": dates, "demand": demand})


class TestTimeSeriesDataset:
    """Tests for TimeSeriesDataset."""

    def test_dataset_length(self):
        data = np.random.randn(100).astype(np.float32)
        dataset = TimeSeriesDataset(data, seq_length=30, horizon=10)
        assert len(dataset) == 100 - 30 - 10 + 1

    def test_dataset_item_shape(self):
        data = np.random.randn(100).astype(np.float32)
        dataset = TimeSeriesDataset(data, seq_length=30, horizon=10)
        x, y = dataset[0]
        assert x.shape == (30,)
        assert y.shape == (10,)

    def test_dataset_empty_when_insufficient(self):
        data = np.random.randn(10).astype(np.float32)
        dataset = TimeSeriesDataset(data, seq_length=30, horizon=10)
        assert len(dataset) == 0


class TestBiLSTMAttention:
    """Tests for BiLSTMAttention network architecture."""

    def test_model_creation(self):
        model = BiLSTMAttention(
            input_size=1, hidden_size=64, num_layers=2,
            forecast_horizon=30, bidirectional=True, use_attention=True
        )
        assert model is not None

    def test_forward_pass(self):
        import torch
        model = BiLSTMAttention(
            input_size=1, hidden_size=32, num_layers=1,
            forecast_horizon=10, bidirectional=True, use_attention=True
        )
        x = torch.randn(4, 30, 1)  # (batch=4, seq=30, features=1)
        output = model(x)
        assert output.shape == (4, 10)  # (batch, forecast_horizon)

    def test_unidirectional(self):
        import torch
        model = BiLSTMAttention(
            input_size=1, hidden_size=32, num_layers=1,
            forecast_horizon=10, bidirectional=False, use_attention=False
        )
        x = torch.randn(2, 30, 1)
        output = model(x)
        assert output.shape == (2, 10)


class TestLSTMDemandModel:
    """Tests for LSTM demand forecasting model."""

    def test_model_creation(self):
        model = LSTMDemandModel(sku_id="TEST-001")
        assert model.sku_id == "TEST-001"
        assert model.is_trained is False

    def test_normalize_denormalize(self):
        model = LSTMDemandModel()
        data = np.array([10, 20, 30, 40, 50], dtype=np.float32)
        normalized = model._normalize(data)
        assert normalized.min() >= 0
        assert normalized.max() <= 1
        denormalized = model._denormalize(normalized)
        np.testing.assert_array_almost_equal(data, denormalized)

    def test_train_short(self, sample_demand_data: pd.DataFrame):
        """Test training with reduced epochs for speed."""
        model = LSTMDemandModel(sku_id="TEST-001")
        # Override settings for fast test
        model.settings.lstm_epochs = 2
        model.settings.lstm_hidden_size = 16
        model.settings.lstm_num_layers = 1
        model.settings.lstm_forecast_horizon = 10
        model.settings.lstm_sequence_length = 10

        metrics = model.train(sample_demand_data)
        assert model.is_trained is True
        assert "mape" in metrics
        assert "rmse" in metrics

    def test_predict_without_training(self):
        model = LSTMDemandModel(sku_id="TEST-001")
        with pytest.raises(RuntimeError, match="must be trained"):
            model.predict(recent_data=np.zeros(30))

    def test_predict_requires_data(self, sample_demand_data: pd.DataFrame):
        model = LSTMDemandModel(sku_id="TEST-001")
        model.settings.lstm_epochs = 2
        model.settings.lstm_hidden_size = 16
        model.settings.lstm_num_layers = 1
        model.settings.lstm_forecast_horizon = 10
        model.settings.lstm_sequence_length = 10

        model.train(sample_demand_data)
        with pytest.raises(ValueError, match="recent_data is required"):
            model.predict()

    def test_save_load(self, sample_demand_data: pd.DataFrame, tmp_path):
        """Test model save/load round-trip."""
        model = LSTMDemandModel(sku_id="TEST-001")
        model.settings.lstm_epochs = 2
        model.settings.lstm_hidden_size = 16
        model.settings.lstm_num_layers = 1
        model.settings.lstm_forecast_horizon = 10
        model.settings.lstm_sequence_length = 10

        model.train(sample_demand_data)

        path = str(tmp_path / "model.pt")
        model.save(path)

        loaded = LSTMDemandModel.load(path)
        assert loaded.is_trained is True
        assert loaded.sku_id == "TEST-001"

    def test_calculate_metrics(self):
        actual = np.array([100, 200, 300, 400, 500], dtype=np.float32)
        predicted = np.array([110, 190, 310, 380, 520], dtype=np.float32)
        metrics = LSTMDemandModel._calculate_metrics(actual, predicted)
        assert metrics["mape"] > 0
        assert metrics["n_samples"] == 5
