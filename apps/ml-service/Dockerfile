# ============================================================
# AMDOX ML Service — Multi-Stage Dockerfile
# ============================================================
# Build:  docker build -t amdox-ml-service .
# Run:    docker run -p 8000:8000 amdox-ml-service
# ============================================================
# Stage 1: Build (python:3.13-slim — pip install, compile)
# Stage 2: Runtime (python:3.13-slim — copy venv, gunicorn)
# ============================================================
# Note: True distroless for Python 3.13 is not yet available.
# Using python:3.13-slim with non-root user as secure alternative.
# ============================================================

# ── Stage 1: Build ─────────────────────────────────────────
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build dependencies (gcc for compiled packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ && \
    rm -rf /var/lib/apt/lists/*

# Create virtual environment for clean copy to runtime
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Layer caching: install dependencies before copying source
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install gunicorn for production serving
RUN pip install --no-cache-dir gunicorn==23.0.0

# Copy source code
COPY . .

# Compile Python files for faster startup
RUN python -m compileall app/

# ── Stage 2: Runtime ──────────────────────────────────────
FROM python:3.13-slim AS runtime

LABEL org.opencontainers.image.title="AMDOX ML Service"
LABEL org.opencontainers.image.description="AMDOX AI/ML Service — FastAPI, scikit-learn, Prophet"
LABEL org.opencontainers.image.vendor="AMDOX"
LABEL org.opencontainers.image.source="https://github.com/amdox/amdox-erp"
LABEL io.amdox.service="ml-service"
LABEL io.amdox.resources.memory="4Gi"
LABEL io.amdox.resources.cpu="2000m"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Create non-root user — security hardening
# Benefits:
#   - Process cannot modify system files even if exploited
#   - Cannot install packages or modify runtime environment
#   - Limits blast radius of container compromise
#   - Required for K8s PodSecurityStandards (restricted)
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /sbin/nologin --create-home appuser && \
    mkdir -p /tmp/ml-models && \
    chown -R appuser:appgroup /tmp/ml-models

# Copy virtual environment from builder (contains all deps)
COPY --from=builder /opt/venv /opt/venv

# Copy application source
COPY --from=builder /build/app ./app
COPY --from=builder /build/__pycache__ ./__pycache__ 2>/dev/null || true

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Production: gunicorn with uvicorn workers
# - workers: 2 * CPU + 1 (adjust via env var GUNICORN_WORKERS)
# - graceful timeout: 30s for long-running ML inference
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
