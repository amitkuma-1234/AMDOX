"""AMDOX ML Service — Demand Forecasting FastAPI Application.

Endpoints:
  POST /train           — Trigger model training
  POST /predict         — Get demand forecast
  POST /predict/batch   — Batch prediction for 1000+ SKUs
  GET  /health          — Health check
  GET  /models          — List registered models
  GET  /metrics         — Model accuracy metrics
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.routers import metrics, models, predict, train

# ── Structured Logging Setup ────────────────────────────────────
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

# Configure standard library logging to use structlog
logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)

logger = structlog.get_logger()


# ── Response Models ─────────────────────────────────────────────
class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: float
    version: str
    service: str
    models_loaded: int = 0
    uptime_seconds: float = 0.0


# ── Application Lifespan ───────────────────────────────────────
_start_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup/shutdown hooks."""
    global _start_time
    _start_time = time.time()

    settings = get_settings()
    logger.info(
        "ml_service_starting",
        version=settings.app_version,
        environment=settings.environment.value,
        mlflow_uri=settings.mlflow_tracking_uri,
    )

    # Ensure artifacts directory exists
    settings.artifacts_dir.mkdir(parents=True, exist_ok=True)

    logger.info("ml_service_started", port=settings.port)
    yield

    # Shutdown
    logger.info("ml_service_shutting_down")


# ── FastAPI Application ─────────────────────────────────────────
app = FastAPI(
    title="AMDOX ML Service",
    description=(
        "AI-powered demand forecasting service for the AMDOX ERP Platform.\n\n"
        "## Models\n"
        "- **Prophet**: SKU-level demand forecasting with seasonal decomposition\n"
        "- **LSTM**: Bidirectional LSTM with attention for high-volume SKUs\n\n"
        "## Features\n"
        "- 90-day forecast horizon with confidence intervals\n"
        "- MLflow model tracking and registry\n"
        "- Redis-cached predictions (24h TTL)\n"
        "- Batch prediction for 1000+ SKUs"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS Middleware ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js frontend
        "http://localhost:4000",  # NestJS API
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ───────────────────────────────────────────
app.include_router(train.router)
app.include_router(predict.router)
app.include_router(models.router)
app.include_router(metrics.router)


# ── Health Check ────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        timestamp=time.time(),
        version=settings.app_version,
        service="amdox-ml-service",
        uptime_seconds=round(time.time() - _start_time, 2),
    )


# ── Root ────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """API root with service information."""
    return {
        "name": "AMDOX ML Service",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "train": "/train",
            "predict": "/predict",
            "predict_batch": "/predict/batch",
            "models": "/models",
            "metrics": "/metrics",
        },
    }


# ── Entrypoint ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )
