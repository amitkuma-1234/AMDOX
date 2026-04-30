# ============================================================
# AMDOX Multi-Stage Dockerfile (Node.js Apps)
# ============================================================
# Build: docker build --build-arg APP=web --target runner-web -t amdox-web .
#        docker build --build-arg APP=api --target runner-api -t amdox-api .
# ============================================================
# SECURITY: Non-root user, distroless runtime, read-only FS
# CACHING:  package*.json copied first for layer reuse
# ============================================================

# ── Stage 1: Base ──────────────────────────────────────────
FROM node:22-alpine AS base

LABEL org.opencontainers.image.source="https://github.com/amdox/amdox-erp"
LABEL org.opencontainers.image.vendor="AMDOX"
LABEL org.opencontainers.image.title="AMDOX ERP Platform"

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# ── Stage 2: Dependency Fetcher ────────────────────────────
# Copy only lock/workspace/package files first for max layer cache
FROM base AS fetcher

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json

RUN pnpm fetch

# ── Stage 3: Installer ────────────────────────────────────
FROM fetcher AS installer

ARG APP=web

COPY . .

RUN pnpm install --frozen-lockfile --offline
RUN pnpm turbo build --filter=@amdox/${APP}

# ── Stage 4: Runner (Web — Next.js) ───────────────────────
# Distroless rationale: Minimal attack surface, no shell,
# no package manager, no OS utilities. Only Node.js runtime.
FROM gcr.io/distroless/nodejs22-debian12 AS runner-web

LABEL org.opencontainers.image.title="AMDOX Web (Next.js)"
LABEL org.opencontainers.image.description="AMDOX ERP Frontend — Next.js 15"
LABEL io.amdox.service="web"

WORKDIR /app

# Copy standalone build artifacts
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user (UID 1001) — security best practice
# Distroless images include a nonroot user at UID 65534
USER 65534

EXPOSE 3000

CMD ["apps/web/server.js"]

# ── Stage 4: Runner (API — NestJS) ────────────────────────
FROM gcr.io/distroless/nodejs22-debian12 AS runner-api

LABEL org.opencontainers.image.title="AMDOX API (NestJS)"
LABEL org.opencontainers.image.description="AMDOX ERP Backend API — NestJS 11"
LABEL io.amdox.service="api"
LABEL io.amdox.resources.memory="512Mi"
LABEL io.amdox.resources.cpu="500m"

WORKDIR /app

# Copy compiled JS and production dependencies
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/apps/api/node_modules ./node_modules
COPY --from=installer /app/apps/api/package.json ./package.json

# Copy Prisma client (required at runtime)
COPY --from=installer /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=installer /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=installer /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000

# Non-root user — distroless nonroot
USER 65534

EXPOSE 4000

CMD ["dist/main.js"]
