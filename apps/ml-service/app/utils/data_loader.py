"""AMDOX ML Service — Data Loader (Postgres → Pandas)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.config import get_settings

logger = logging.getLogger(__name__)


class DataLoader:
    """Load demand data from PostgreSQL for model training and prediction.

    Fetches data from:
    - inventory_items: SKU metadata
    - stock_movements: historical demand (OUT movements = demand)

    Feature engineering:
    - Lag features (7, 14, 30, 60, 90 day)
    - Rolling averages (7, 14, 30 day)
    - Seasonality indicators (day of week, month, quarter)
    - Holiday flags
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._engine: Engine | None = None

    def _get_engine(self) -> Engine:
        """Get SQLAlchemy engine for database connections."""
        if self._engine is None:
            self._engine = create_engine(
                self.settings.database_url,
                pool_size=5,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=1800,
            )
        return self._engine

    async def load_demand_data(
        self,
        sku_id: str,
        min_days: int | None = None,
    ) -> pd.DataFrame | None:
        """Load historical demand data for a SKU.

        Aggregates stock movements (type='OUT') by date.

        Args:
            sku_id: SKU identifier.
            min_days: Minimum number of days of data required.

        Returns:
            DataFrame with 'date' and 'demand' columns, or None if insufficient.
        """
        min_days = min_days or self.settings.min_training_days
        engine = self._get_engine()

        query = text("""
            SELECT
                DATE(sm.timestamp) AS date,
                ABS(SUM(sm.quantity)) AS demand
            FROM stock_movements sm
            JOIN inventory_items ii ON sm.inventory_item_id = ii.id
            WHERE ii.sku = :sku_id
              AND sm.type = 'OUT'
              AND sm.timestamp >= NOW() - INTERVAL :lookback_days
            GROUP BY DATE(sm.timestamp)
            ORDER BY date
        """)

        try:
            with engine.connect() as conn:
                df = pd.read_sql(
                    query,
                    conn,
                    params={
                        "sku_id": sku_id,
                        "lookback_days": f"{min_days + 365} days",  # Extra buffer
                    },
                )

            if df.empty or len(df) < min_days:
                logger.warning(
                    f"Insufficient demand data for SKU {sku_id}: "
                    f"{len(df)} days (need {min_days})"
                )
                return None

            # Fill missing dates with zero demand
            df["date"] = pd.to_datetime(df["date"])
            date_range = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
            df = df.set_index("date").reindex(date_range, fill_value=0).reset_index()
            df.columns = ["date", "demand"]

            # Add engineered features
            df = self._add_features(df)

            logger.info(f"Loaded {len(df)} data points for SKU {sku_id}")
            return df

        except Exception as e:
            logger.error(f"Failed to load demand data for SKU {sku_id}: {e}")
            return None

    async def load_recent_demand(
        self,
        sku_id: str,
        days: int = 30,
    ) -> np.ndarray | None:
        """Load recent demand values for LSTM prediction input.

        Args:
            sku_id: SKU identifier.
            days: Number of recent days to load.

        Returns:
            NumPy array of demand values, or None if insufficient.
        """
        engine = self._get_engine()

        query = text("""
            SELECT
                DATE(sm.timestamp) AS date,
                ABS(SUM(sm.quantity)) AS demand
            FROM stock_movements sm
            JOIN inventory_items ii ON sm.inventory_item_id = ii.id
            WHERE ii.sku = :sku_id
              AND sm.type = 'OUT'
              AND sm.timestamp >= NOW() - INTERVAL :lookback_days
            GROUP BY DATE(sm.timestamp)
            ORDER BY date
        """)

        try:
            with engine.connect() as conn:
                df = pd.read_sql(
                    query,
                    conn,
                    params={
                        "sku_id": sku_id,
                        "lookback_days": f"{days + 7} days",  # Extra buffer
                    },
                )

            if df.empty:
                return None

            # Fill missing dates
            df["date"] = pd.to_datetime(df["date"])
            date_range = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
            df = df.set_index("date").reindex(date_range, fill_value=0).reset_index()

            # Return last N days
            values = df["demand"].values[-days:]
            return values.astype(np.float32) if len(values) >= days else None

        except Exception as e:
            logger.error(f"Failed to load recent demand for SKU {sku_id}: {e}")
            return None

    async def get_active_sku_ids(self) -> list[str]:
        """Get list of all active SKU IDs from the database.

        Returns:
            List of SKU identifier strings.
        """
        engine = self._get_engine()

        query = text("""
            SELECT sku
            FROM inventory_items
            WHERE is_active = true
              AND deleted_at IS NULL
            ORDER BY sku
        """)

        try:
            with engine.connect() as conn:
                result = conn.execute(query)
                return [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get active SKU IDs: {e}")
            return []

    def _add_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add engineered features to the demand DataFrame.

        Features:
        - Lag features (configurable)
        - Rolling averages (configurable)
        - Day of week, month, quarter
        - Is weekend flag
        """
        # Lag features
        for lag in self.settings.lag_features:
            df[f"lag_{lag}"] = df["demand"].shift(lag).fillna(0)

        # Rolling averages
        for window in self.settings.rolling_windows:
            df[f"rolling_avg_{window}"] = (
                df["demand"].rolling(window=window, min_periods=1).mean()
            )
            df[f"rolling_std_{window}"] = (
                df["demand"].rolling(window=window, min_periods=1).std().fillna(0)
            )

        # Temporal features
        df["day_of_week"] = df["date"].dt.dayofweek
        df["month"] = df["date"].dt.month
        df["quarter"] = df["date"].dt.quarter
        df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        df["day_of_year"] = df["date"].dt.dayofyear

        # Year-over-year change (if enough data)
        if len(df) > 365:
            df["yoy_change"] = df["demand"] - df["demand"].shift(365)
            df["yoy_change"] = df["yoy_change"].fillna(0)

        return df
