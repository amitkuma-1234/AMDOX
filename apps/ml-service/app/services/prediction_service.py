"""AMDOX ML Service — Prediction Service."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import numpy as np
import redis.asyncio as redis

from app.config import get_settings
from app.models.lstm_model import LSTMDemandModel
from app.models.prophet_model import ProphetDemandModel
from app.utils.data_loader import DataLoader

logger = logging.getLogger(__name__)


class PredictionService:
    """Handles demand forecast predictions with Redis caching.

    Features:
    - Single SKU prediction with confidence intervals
    - Batch prediction for 1000+ SKUs
    - Redis caching with 24h TTL
    - Stale cache fallback if models unavailable
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.data_loader = DataLoader()
        self._redis: redis.Redis | None = None
        self._loaded_models: dict[str, Any] = {}

    async def _get_redis(self) -> redis.Redis | None:
        """Get Redis connection for caching."""
        if self._redis is None:
            try:
                self._redis = redis.from_url(
                    self.settings.redis_url,
                    decode_responses=True,
                )
                await self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
                self._redis = None
        return self._redis

    def _cache_key(self, sku_id: str, horizon: int) -> str:
        """Generate Redis cache key."""
        return f"amdox:forecast:{sku_id}:h{horizon}"

    async def _get_cached(self, sku_id: str, horizon: int) -> dict[str, Any] | None:
        """Get cached prediction from Redis."""
        r = await self._get_redis()
        if r is None:
            return None
        try:
            key = self._cache_key(sku_id, horizon)
            data = await r.get(key)
            if data:
                logger.debug(f"Cache hit for SKU {sku_id}")
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Cache read failed: {e}")
        return None

    async def _set_cached(self, sku_id: str, horizon: int, data: dict[str, Any]) -> None:
        """Cache prediction in Redis with TTL."""
        r = await self._get_redis()
        if r is None:
            return
        try:
            key = self._cache_key(sku_id, horizon)
            await r.setex(
                key,
                self.settings.prediction_cache_ttl,
                json.dumps(data, default=str),
            )
            logger.debug(f"Cached prediction for SKU {sku_id}")
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

    def _load_prophet_model(self, sku_id: str) -> ProphetDemandModel | None:
        """Load a trained Prophet model from artifacts."""
        cache_key = f"prophet_{sku_id}"
        if cache_key in self._loaded_models:
            return self._loaded_models[cache_key]

        artifact_path = self.settings.artifacts_dir / f"prophet_{sku_id}.json"
        if not artifact_path.exists():
            return None

        try:
            model_json = artifact_path.read_text()
            model = ProphetDemandModel.deserialize(model_json, sku_id=sku_id)
            self._loaded_models[cache_key] = model
            return model
        except Exception as e:
            logger.error(f"Failed to load Prophet model for {sku_id}: {e}")
            return None

    def _load_lstm_model(self, sku_id: str) -> LSTMDemandModel | None:
        """Load a trained LSTM model from artifacts."""
        cache_key = f"lstm_{sku_id}"
        if cache_key in self._loaded_models:
            return self._loaded_models[cache_key]

        artifact_path = self.settings.artifacts_dir / f"lstm_{sku_id}.pt"
        if not artifact_path.exists():
            return None

        try:
            model = LSTMDemandModel.load(str(artifact_path))
            self._loaded_models[cache_key] = model
            return model
        except Exception as e:
            logger.error(f"Failed to load LSTM model for {sku_id}: {e}")
            return None

    async def predict(
        self,
        sku_id: str,
        horizon_days: int | None = None,
        model_type: str | None = None,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        """Generate demand forecast for a single SKU.

        Args:
            sku_id: SKU identifier.
            horizon_days: Forecast horizon in days (default: 90).
            model_type: Force specific model type ('prophet' or 'lstm').
            use_cache: Whether to check/store in Redis cache.

        Returns:
            Forecast data with confidence intervals.
        """
        horizon = horizon_days or self.settings.prophet_forecast_horizon

        # Check cache first
        if use_cache:
            cached = await self._get_cached(sku_id, horizon)
            if cached:
                cached["from_cache"] = True
                return cached

        # Try to load and predict with best available model
        result = None

        if model_type in (None, "prophet"):
            prophet_model = self._load_prophet_model(sku_id)
            if prophet_model:
                try:
                    result = prophet_model.predict(horizon_days=horizon)
                    result["model_type"] = "prophet"
                except Exception as e:
                    logger.error(f"Prophet prediction failed for {sku_id}: {e}")

        if result is None and model_type in (None, "lstm"):
            lstm_model = self._load_lstm_model(sku_id)
            if lstm_model:
                try:
                    # Get recent data for LSTM input
                    recent = await self.data_loader.load_recent_demand(
                        sku_id, days=self.settings.lstm_sequence_length
                    )
                    if recent is not None and len(recent) >= self.settings.lstm_sequence_length:
                        result = lstm_model.predict(recent_data=recent)
                        result["model_type"] = "lstm"
                except Exception as e:
                    logger.error(f"LSTM prediction failed for {sku_id}: {e}")

        if result is None:
            # Try stale cache as fallback
            if use_cache:
                stale = await self._get_cached(sku_id, horizon)
                if stale:
                    stale["from_cache"] = True
                    stale["stale"] = True
                    return stale

            return {
                "sku_id": sku_id,
                "status": "no_model",
                "message": f"No trained model available for SKU {sku_id}",
            }

        # Add metadata
        result["predicted_at"] = datetime.utcnow().isoformat()
        result["from_cache"] = False

        # Cache the result
        if use_cache:
            await self._set_cached(sku_id, horizon, result)

        return result

    async def predict_batch(
        self,
        sku_ids: list[str],
        horizon_days: int | None = None,
        model_type: str | None = None,
    ) -> dict[str, Any]:
        """Batch predict demand for multiple SKUs.

        Args:
            sku_ids: List of SKU identifiers (max: settings.max_batch_size).
            horizon_days: Forecast horizon in days.
            model_type: Force specific model type.

        Returns:
            Batch prediction results.
        """
        if len(sku_ids) > self.settings.max_batch_size:
            return {
                "status": "error",
                "message": f"Batch size {len(sku_ids)} exceeds max {self.settings.max_batch_size}",
            }

        logger.info(f"Starting batch prediction for {len(sku_ids)} SKUs")

        results = {
            "total": len(sku_ids),
            "successful": 0,
            "failed": 0,
            "cached": 0,
            "predictions": [],
        }

        for sku_id in sku_ids:
            try:
                prediction = await self.predict(
                    sku_id=sku_id,
                    horizon_days=horizon_days,
                    model_type=model_type,
                )
                results["predictions"].append(prediction)

                if prediction.get("from_cache"):
                    results["cached"] += 1
                if prediction.get("status") != "no_model":
                    results["successful"] += 1
                else:
                    results["failed"] += 1

            except Exception as e:
                logger.error(f"Batch prediction failed for SKU {sku_id}: {e}")
                results["failed"] += 1
                results["predictions"].append({
                    "sku_id": sku_id,
                    "status": "error",
                    "message": str(e),
                })

        results["predicted_at"] = datetime.utcnow().isoformat()
        return results

    def clear_model_cache(self) -> None:
        """Clear in-memory model cache (force reload on next prediction)."""
        self._loaded_models.clear()
        logger.info("Model cache cleared")
