"""AMDOX ML Service — AI-powered document intelligence."""

import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: float
    version: str
    service: str


class PredictionRequest(BaseModel):
    """Base prediction request model."""
    text: str
    model_name: str = "default"
    options: dict[str, Any] = {}


class PredictionResponse(BaseModel):
    """Base prediction response model."""
    prediction: Any
    confidence: float
    model_name: str
    processing_time_ms: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup: load models, warm up caches
    print("🚀 AMDOX ML Service starting up...")
    print("📦 Loading ML models...")
    # TODO: Load ML models here
    yield
    # Shutdown: cleanup resources
    print("👋 AMDOX ML Service shutting down...")


app = FastAPI(
    title="AMDOX ML Service",
    description="AI-powered document intelligence and ML inference service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
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


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=time.time(),
        version="0.1.0",
        service="amdox-ml-service",
    )


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """API root with service information."""
    return {
        "name": "AMDOX ML Service",
        "version": "0.1.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.post("/predict", response_model=PredictionResponse, tags=["inference"])
async def predict(request: PredictionRequest) -> PredictionResponse:
    """Run ML inference on the provided text.

    This is a placeholder endpoint — replace with actual model inference.
    """
    start_time = time.perf_counter()

    # TODO: Replace with actual ML model inference
    prediction = {
        "label": "document",
        "entities": [],
        "summary": f"Processed text of length {len(request.text)}",
    }

    processing_time = (time.perf_counter() - start_time) * 1000

    return PredictionResponse(
        prediction=prediction,
        confidence=0.95,
        model_name=request.model_name,
        processing_time_ms=round(processing_time, 2),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
