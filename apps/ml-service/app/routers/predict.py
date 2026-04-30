"""AMDOX ML Service — Prediction Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["prediction"])

prediction_service = PredictionService()


class PredictRequest(BaseModel):
    """Prediction request payload."""
    sku_id: str = Field(..., description="SKU identifier")
    horizon_days: int | None = Field(None, description="Forecast horizon in days (default: 90)")
    model_type: str | None = Field(None, description="Force model type: 'prophet' or 'lstm'")
    use_cache: bool = Field(True, description="Use Redis cache")


class BatchPredictRequest(BaseModel):
    """Batch prediction request payload."""
    sku_ids: list[str] = Field(..., description="List of SKU identifiers (max 1000)")
    horizon_days: int | None = Field(None, description="Forecast horizon in days")
    model_type: str | None = Field(None, description="Force model type")


@router.post("")
async def predict(request: PredictRequest) -> dict[str, Any]:
    """Get demand forecast for a single SKU.

    Returns prediction with confidence intervals, cached for 24h.
    Falls back to stale cache if model is unavailable.
    """
    try:
        result = await prediction_service.predict(
            sku_id=request.sku_id,
            horizon_days=request.horizon_days,
            model_type=request.model_type,
            use_cache=request.use_cache,
        )
        return result
    except Exception as e:
        logger.error(f"Prediction failed for SKU {request.sku_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def predict_batch(request: BatchPredictRequest) -> dict[str, Any]:
    """Batch predict demand for multiple SKUs (up to 1000).

    Efficiently processes multiple SKUs with caching support.
    """
    if len(request.sku_ids) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Maximum batch size is 1000 SKUs",
        )

    try:
        result = await prediction_service.predict_batch(
            sku_ids=request.sku_ids,
            horizon_days=request.horizon_days,
            model_type=request.model_type,
        )
        return result
    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
