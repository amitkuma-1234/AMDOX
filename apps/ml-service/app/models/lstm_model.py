"""AMDOX ML Service — Bidirectional LSTM with Attention for Demand Forecasting."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

from app.config import get_settings

logger = logging.getLogger(__name__)


class TimeSeriesDataset(Dataset):
    """PyTorch Dataset for time-series sequences."""

    def __init__(self, data: np.ndarray, seq_length: int, horizon: int) -> None:
        self.data = torch.FloatTensor(data)
        self.seq_length = seq_length
        self.horizon = horizon

    def __len__(self) -> int:
        return max(0, len(self.data) - self.seq_length - self.horizon + 1)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        x = self.data[idx : idx + self.seq_length]
        y = self.data[idx + self.seq_length : idx + self.seq_length + self.horizon]
        return x, y


class Attention(nn.Module):
    """Bahdanau-style attention mechanism."""

    def __init__(self, hidden_size: int) -> None:
        super().__init__()
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )

    def forward(self, lstm_output: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            lstm_output: (batch, seq_len, hidden_size * 2) for bidirectional

        Returns:
            context: (batch, hidden_size * 2) weighted context vector
            weights: (batch, seq_len) attention weights
        """
        weights = self.attention(lstm_output).squeeze(-1)
        weights = torch.softmax(weights, dim=1)
        context = torch.bmm(weights.unsqueeze(1), lstm_output).squeeze(1)
        return context, weights


class BiLSTMAttention(nn.Module):
    """Bidirectional LSTM with Attention for demand forecasting.

    Architecture:
    - Input layer with batch normalization
    - Bidirectional LSTM (multi-layer)
    - Bahdanau attention mechanism
    - Fully connected output layer
    """

    def __init__(
        self,
        input_size: int = 1,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        forecast_horizon: int = 90,
        bidirectional: bool = True,
        use_attention: bool = True,
    ) -> None:
        super().__init__()

        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.use_attention = use_attention
        self.num_directions = 2 if bidirectional else 1

        # Batch normalization on input
        self.batch_norm = nn.BatchNorm1d(input_size)

        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )

        # Attention layer
        if use_attention:
            self.attention = Attention(hidden_size)

        # Output layers
        lstm_output_size = hidden_size * self.num_directions
        self.fc = nn.Sequential(
            nn.Linear(lstm_output_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, forecast_horizon),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, input_size)

        Returns:
            output: (batch, forecast_horizon)
        """
        # Batch norm: (batch, input_size, seq_len) -> (batch, seq_len, input_size)
        x_norm = self.batch_norm(x.permute(0, 2, 1)).permute(0, 2, 1)

        # LSTM
        lstm_out, _ = self.lstm(x_norm)

        # Attention or use last hidden state
        if self.use_attention:
            context, _ = self.attention(lstm_out)
        else:
            # Use last timestep output
            if self.bidirectional:
                context = torch.cat(
                    (lstm_out[:, -1, : self.hidden_size], lstm_out[:, 0, self.hidden_size :]),
                    dim=1,
                )
            else:
                context = lstm_out[:, -1, :]

        # Fully connected output
        output = self.fc(context)
        return output


class LSTMDemandModel:
    """LSTM-based demand forecasting for high-volume SKUs.

    Features:
    - Bidirectional LSTM with attention mechanism
    - Sequence length: 30 days, forecast: 90 days
    - Batch normalization and dropout regularization
    - Early stopping with patience
    """

    def __init__(self, sku_id: str | None = None) -> None:
        self.sku_id = sku_id
        self.model: BiLSTMAttention | None = None
        self.settings = get_settings()
        self.is_trained = False
        self.metrics: dict[str, float] = {}
        self.scaler_min: float = 0.0
        self.scaler_max: float = 1.0
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def _normalize(self, data: np.ndarray) -> np.ndarray:
        """Min-max normalize data to [0, 1]."""
        self.scaler_min = float(data.min())
        self.scaler_max = float(data.max())
        if self.scaler_max == self.scaler_min:
            return np.zeros_like(data)
        return (data - self.scaler_min) / (self.scaler_max - self.scaler_min)

    def _denormalize(self, data: np.ndarray) -> np.ndarray:
        """Reverse min-max normalization."""
        return data * (self.scaler_max - self.scaler_min) + self.scaler_min

    def _prepare_data(self, df: pd.DataFrame) -> np.ndarray:
        """Prepare time-series data from DataFrame."""
        demand = df.sort_values("date")["demand"].values.astype(np.float32)
        return self._normalize(demand)

    def train(self, df: pd.DataFrame) -> dict[str, float]:
        """Train the LSTM model on historical demand data.

        Args:
            df: DataFrame with 'date' and 'demand' columns.

        Returns:
            Dictionary of training metrics.
        """
        logger.info(f"Training LSTM model for SKU {self.sku_id}, {len(df)} data points")

        data = self._prepare_data(df)
        seq_length = self.settings.lstm_sequence_length
        horizon = self.settings.lstm_forecast_horizon

        # Time-series aware split
        split_idx = int(len(data) * self.settings.train_test_split_ratio)
        train_data = data[:split_idx]
        test_data = data[split_idx:]

        # Create datasets
        train_dataset = TimeSeriesDataset(train_data, seq_length, horizon)
        if len(train_dataset) == 0:
            logger.warning(f"Insufficient training data for SKU {self.sku_id}")
            return {"mape": 999.0, "rmse": 999.0, "mae": 999.0, "n_samples": 0}

        train_loader = DataLoader(
            train_dataset,
            batch_size=self.settings.lstm_batch_size,
            shuffle=False,  # Preserve time ordering
        )

        # Initialize model
        self.model = BiLSTMAttention(
            input_size=1,
            hidden_size=self.settings.lstm_hidden_size,
            num_layers=self.settings.lstm_num_layers,
            dropout=self.settings.lstm_dropout,
            forecast_horizon=horizon,
            bidirectional=self.settings.lstm_bidirectional,
            use_attention=self.settings.lstm_use_attention,
        ).to(self.device)

        # Training setup
        optimizer = torch.optim.Adam(
            self.model.parameters(), lr=self.settings.lstm_learning_rate
        )
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", factor=0.5, patience=5
        )
        criterion = nn.MSELoss()

        # Training loop with early stopping
        best_loss = float("inf")
        patience_counter = 0
        best_state = None

        self.model.train()
        for epoch in range(self.settings.lstm_epochs):
            epoch_loss = 0.0
            n_batches = 0

            for batch_x, batch_y in train_loader:
                batch_x = batch_x.unsqueeze(-1).to(self.device)  # (batch, seq, 1)
                batch_y = batch_y.to(self.device)

                optimizer.zero_grad()
                output = self.model(batch_x)

                # Trim output to match target length
                min_len = min(output.shape[1], batch_y.shape[1])
                loss = criterion(output[:, :min_len], batch_y[:, :min_len])

                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()

                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / max(n_batches, 1)
            scheduler.step(avg_loss)

            # Early stopping
            if avg_loss < best_loss:
                best_loss = avg_loss
                patience_counter = 0
                best_state = self.model.state_dict().copy()
            else:
                patience_counter += 1

            if patience_counter >= self.settings.lstm_early_stopping_patience:
                logger.info(f"Early stopping at epoch {epoch + 1}")
                break

            if (epoch + 1) % 10 == 0:
                logger.info(
                    f"SKU {self.sku_id} - Epoch {epoch + 1}/{self.settings.lstm_epochs}, "
                    f"Loss: {avg_loss:.6f}"
                )

        # Restore best model
        if best_state is not None:
            self.model.load_state_dict(best_state)

        # Evaluate on test set
        if len(test_data) > seq_length + horizon:
            self.metrics = self._evaluate(test_data, seq_length, horizon)
        else:
            self.metrics = {"mape": 0.0, "rmse": 0.0, "mae": 0.0, "n_samples": 0}

        self.is_trained = True
        logger.info(
            f"LSTM model trained for SKU {self.sku_id}: "
            f"MAPE={self.metrics['mape']:.2f}%, RMSE={self.metrics['rmse']:.4f}"
        )
        return self.metrics

    def _evaluate(
        self, test_data: np.ndarray, seq_length: int, horizon: int
    ) -> dict[str, float]:
        """Evaluate model on test data."""
        if self.model is None:
            return {"mape": 999.0, "rmse": 999.0, "mae": 999.0, "n_samples": 0}

        test_dataset = TimeSeriesDataset(test_data, seq_length, horizon)
        if len(test_dataset) == 0:
            return {"mape": 0.0, "rmse": 0.0, "mae": 0.0, "n_samples": 0}

        test_loader = DataLoader(test_dataset, batch_size=self.settings.lstm_batch_size)

        self.model.eval()
        all_actual = []
        all_predicted = []

        with torch.no_grad():
            for batch_x, batch_y in test_loader:
                batch_x = batch_x.unsqueeze(-1).to(self.device)
                output = self.model(batch_x)

                min_len = min(output.shape[1], batch_y.shape[1])
                predicted = self._denormalize(output[:, :min_len].cpu().numpy())
                actual = self._denormalize(batch_y[:, :min_len].numpy())

                all_actual.append(actual.flatten())
                all_predicted.append(predicted.flatten())

        actual = np.concatenate(all_actual)
        predicted = np.concatenate(all_predicted)

        return self._calculate_metrics(actual, predicted)

    def predict(self, recent_data: np.ndarray | None = None) -> dict[str, Any]:
        """Generate demand forecast.

        Args:
            recent_data: Recent demand values (last `seq_length` days).
                         Must be raw (un-normalized) values.

        Returns:
            Dictionary with forecast data.
        """
        if not self.is_trained or self.model is None:
            raise RuntimeError("Model must be trained before prediction")

        horizon = self.settings.lstm_forecast_horizon
        seq_length = self.settings.lstm_sequence_length

        if recent_data is None:
            raise ValueError("recent_data is required for LSTM prediction")

        # Normalize input
        normalized = (recent_data - self.scaler_min) / (self.scaler_max - self.scaler_min + 1e-8)
        input_tensor = torch.FloatTensor(normalized).unsqueeze(0).unsqueeze(-1).to(self.device)

        self.model.eval()
        with torch.no_grad():
            output = self.model(input_tensor)

        # Denormalize predictions
        predictions = self._denormalize(output.cpu().numpy().flatten())

        # Calculate simple confidence intervals (±1.96 * std from training error)
        std_error = self.metrics.get("rmse", 0.0)
        ci_multiplier = 1.96

        return {
            "sku_id": self.sku_id,
            "horizon_days": horizon,
            "model_type": "lstm",
            "forecast": [
                {
                    "day": i + 1,
                    "predicted_demand": round(max(0, float(pred)), 2),
                    "lower_bound": round(max(0, float(pred - ci_multiplier * std_error)), 2),
                    "upper_bound": round(max(0, float(pred + ci_multiplier * std_error)), 2),
                }
                for i, pred in enumerate(predictions[:horizon])
            ],
            "metrics": self.metrics,
        }

    def save(self, path: str) -> None:
        """Save model state to file."""
        if self.model is None:
            raise RuntimeError("No model to save")

        state = {
            "model_state_dict": self.model.state_dict(),
            "scaler_min": self.scaler_min,
            "scaler_max": self.scaler_max,
            "metrics": self.metrics,
            "sku_id": self.sku_id,
            "config": {
                "hidden_size": self.settings.lstm_hidden_size,
                "num_layers": self.settings.lstm_num_layers,
                "dropout": self.settings.lstm_dropout,
                "forecast_horizon": self.settings.lstm_forecast_horizon,
                "bidirectional": self.settings.lstm_bidirectional,
                "use_attention": self.settings.lstm_use_attention,
            },
        }
        torch.save(state, path)
        logger.info(f"LSTM model saved to {path}")

    @classmethod
    def load(cls, path: str) -> LSTMDemandModel:
        """Load model state from file."""
        state = torch.load(path, map_location="cpu", weights_only=False)
        instance = cls(sku_id=state.get("sku_id"))
        config = state["config"]

        instance.model = BiLSTMAttention(
            input_size=1,
            hidden_size=config["hidden_size"],
            num_layers=config["num_layers"],
            dropout=config["dropout"],
            forecast_horizon=config["forecast_horizon"],
            bidirectional=config["bidirectional"],
            use_attention=config["use_attention"],
        )
        instance.model.load_state_dict(state["model_state_dict"])
        instance.scaler_min = state["scaler_min"]
        instance.scaler_max = state["scaler_max"]
        instance.metrics = state["metrics"]
        instance.is_trained = True

        logger.info(f"LSTM model loaded from {path}")
        return instance

    @staticmethod
    def _calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
        """Calculate forecast accuracy metrics."""
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
