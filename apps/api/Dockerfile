# ============================================================
# AMDOX API — Standalone Multi-Stage Dockerfile
# ============================================================
# Build:  docker build -t amdox-api .
# Run:    docker run -p 4000:4000 amdox-api
# ============================================================
# Stage 1: Build (node:22-alpine — install deps, compile TS)
# Stage 2: Runtime (distroless:nodejs22 — minimal, secure)
# ============================================================

# ── Stage 1: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.title="AMDOX API Builder"

# Install build tools
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Layer caching optimization: copy dependency manifests first
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies (prefer pnpm if lock exists)
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && corepack prepare pnpm@9.15.4 --activate && \
      pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci --ignore-scripts; \
    else \
      npm install; \
    fi

# Copy source code (after deps for caching)
COPY . .

# Generate Prisma client if schema exists
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate; fi

# Build TypeScript → JavaScript
RUN npm run build

# Prune dev dependencies for smaller runtime image
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm prune --prod; \
    else \
      npm prune --production; \
    fi

# ── Stage 2: Runtime ──────────────────────────────────────
# Distroless rationale:
#   - No shell, no package manager → minimal attack surface
#   - No OS utilities → cannot be exploited for lateral movement
#   - ~20MB base vs ~120MB for alpine → faster pulls, less CVEs
FROM gcr.io/distroless/nodejs22-debian12 AS runtime

LABEL org.opencontainers.image.title="AMDOX API"
LABEL org.opencontainers.image.description="AMDOX ERP Backend — NestJS 11, Node.js 22"
LABEL org.opencontainers.image.vendor="AMDOX"
LABEL org.opencontainers.image.source="https://github.com/amdox/amdox-erp"
LABEL io.amdox.service="api"
LABEL io.amdox.resources.memory="512Mi"
LABEL io.amdox.resources.cpu="500m"

WORKDIR /app

# Copy only production artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy Prisma runtime (if applicable)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

ENV NODE_ENV=production
ENV PORT=4000

# Non-root user security benefits:
#   - Process cannot modify system files even if exploited
#   - Cannot bind to privileged ports (<1024)
#   - Cannot install packages or modify runtime
#   - Limits blast radius of container escape
USER 65534

EXPOSE 4000

# Health check: verify API is serving requests
# Note: distroless has no curl/wget, health check done via K8s probes
# For docker-compose, use the docker-compose healthcheck directive

CMD ["dist/main.js"]
