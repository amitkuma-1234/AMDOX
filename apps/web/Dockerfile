# ============================================================
# AMDOX Web — Standalone Multi-Stage Dockerfile
# ============================================================
# Build:  docker build -t amdox-web .
# Run:    docker run -p 3000:3000 amdox-web
# ============================================================
# Stage 1: Build (node:22-alpine — install deps, next build)
# Stage 2: Runtime (distroless:nodejs22 — serve Next.js)
# ============================================================

# ── Stage 1: Dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

LABEL org.opencontainers.image.title="AMDOX Web Dependencies"

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Layer caching: copy manifests first
COPY package.json package-lock.json* pnpm-lock.yaml* ./

RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@9.15.4 --activate && \
      pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# ── Stage 2: Build ────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry by default — disable in CI
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
# output: 'standalone' must be set in next.config.ts for optimal Docker builds
RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────
# Distroless rationale:
#   - No shell, no package manager → minimal attack surface
#   - Optimized for Node.js workloads
#   - Static files served from CDN in production (see Helm chart)
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

LABEL org.opencontainers.image.title="AMDOX Web"
LABEL org.opencontainers.image.description="AMDOX ERP Frontend — Next.js 15, React 19"
LABEL org.opencontainers.image.vendor="AMDOX"
LABEL org.opencontainers.image.source="https://github.com/amdox/amdox-erp"
LABEL io.amdox.service="web"

WORKDIR /app

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# CDN configuration for static assets in production:
# Set ASSET_PREFIX env var to point to CloudFront/CDN URL
# e.g. ASSET_PREFIX=https://cdn.amdox.io

# Non-root user — security hardening
USER 65534

EXPOSE 3000

CMD ["server.js"]
