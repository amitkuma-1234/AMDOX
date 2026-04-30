"""AMDOX ML Service — Training Router."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.services.training_service import TrainingService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/train", tags=["training"])

training_service = TrainingService()


class TrainRequest(BaseModel):
    """Training request payload."""
    sku_id: str | None = Field(None, description="Specific SKU to train (null = all)")
    sku_ids: list[str] | None = Field(None, description="List of SKUs for batch training")
    model_type: str = Field("auto", description="Model type: 'prophet', 'lstm', or 'auto'")
    force: bool = Field(False, description="Force retraining even if recent model exists")


class TrainResponse(BaseModel):
    """Training response."""
    status: str
    message: str
    task_id: str | None = None
    result: dict[str, Any] | None = None


# Track background training tasks
_training_tasks: dict[str, dict[str, Any]] = {}


async def _run_training(task_id: str, request: TrainRequest) -> None:
    """Background training task."""
    try:
        _training_tasks[task_id] = {"status": "running", "started_at": "now"}

        if request.sku_ids:
            result = await training_service.train_batch(
                sku_ids=request.sku_ids, model_type=request.model_type
            )
        elif request.sku_id:
            result = await training_service.train_sku(
                sku_id=request.sku_id,
                model_type=request.model_type,
                force=request.force,
            )
        else:
            result = await training_service.train_batch(model_type=request.model_type)

        _training_tasks[task_id] = {"status": "completed", "result": result}
    except Exception as e:
        logger.error(f"Training task {task_id} failed: {e}")
        _training_tasks[task_id] = {"status": "failed", "error": str(e)}


@router.post("", response_model=TrainResponse)
async def trigger_training(
    request: TrainRequest,
    background_tasks: BackgroundTasks,
) -> TrainResponse:
    """Trigger model training.

    - Single SKU: provide `sku_id`
    - Batch: provide `sku_ids` list
    - All SKUs: omit both (trains all active SKUs)

    Training runs in the background. Use the returned task_id to poll status.
    """
    import uuid
    task_id = str(uuid.uuid4())

    background_tasks.add_task(_run_training, task_id, request)

    return TrainResponse(
        status="accepted",
        message="Training job submitted",
        task_id=task_id,
    )


@router.get("/status/{task_id}")
async def get_training_status(task_id: str) -> dict[str, Any]:
    """Get status of a training task."""
    if task_id not in _training_tasks:
        raise HTTPException(status_code=404, detail="Training task not found")
    return {"task_id": task_id, **_training_tasks[task_id]}
