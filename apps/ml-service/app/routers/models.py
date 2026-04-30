"""AMDOX ML Service — Models Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from app.models.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/models", tags=["models"])

registry = ModelRegistry()


@router.get("")
async def list_models() -> dict[str, Any]:
    """List all registered models with versions and stages."""
    models = registry.list_models()
    return {
        "total": len(models),
        "models": models,
    }


@router.get("/{sku_id}/best")
async def get_best_model(sku_id: str) -> dict[str, Any]:
    """Get the best performing model for a specific SKU."""
    best = registry.get_best_model_for_sku(sku_id)
    if best is None:
        return {"sku_id": sku_id, "status": "no_model", "message": "No model found for this SKU"}
    return {"sku_id": sku_id, "best_model": best}


@router.post("/{model_name}/promote/{version}")
async def promote_model(model_name: str, version: int) -> dict[str, Any]:
    """Promote a model version to production stage."""
    success = registry.promote_to_production(model_name, version)
    if success:
        return {"status": "promoted", "model": model_name, "version": version, "stage": "Production"}
    return {"status": "failed", "message": "Failed to promote model"}
