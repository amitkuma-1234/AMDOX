"""AMDOX ML Service — Metrics Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from app.models.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])

registry = ModelRegistry()


@router.get("")
async def get_metrics() -> dict[str, Any]:
    """Get model accuracy metrics summary for all SKUs.

    Returns MAPE, RMSE, MAE for the best model per SKU.
    """
    summaries = registry.get_metrics_summary()
    return {
        "total_skus": len(summaries),
        "metrics": summaries,
        "targets": {
            "mape_threshold": 12.0,
            "alert_threshold": 15.0,
        },
    }


@router.get("/health-score")
async def get_model_health_score() -> dict[str, Any]:
    """Get overall model health score across all SKUs.

    Health score is based on percentage of SKUs meeting MAPE target.
    """
    summaries = registry.get_metrics_summary()
    if not summaries:
        return {"health_score": 0, "total_skus": 0, "meeting_target": 0}

    meeting_target = sum(
        1 for s in summaries if s.get("best_mape", 999) < 12.0
    )
    health_score = round((meeting_target / len(summaries)) * 100, 1)

    return {
        "health_score": health_score,
        "total_skus": len(summaries),
        "meeting_target": meeting_target,
        "below_target": len(summaries) - meeting_target,
        "average_mape": round(
            sum(s.get("best_mape", 0) for s in summaries) / len(summaries), 2
        ),
    }
