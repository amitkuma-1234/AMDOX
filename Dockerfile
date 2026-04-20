# ============================================================
# AMDOX Multi-Stage Dockerfile (Node.js Apps)
# ============================================================
# Build: docker build --build-arg APP=web -t amdox-web .
#        docker build --build-arg APP=api -t amdox-api .
# ============================================================

# ---- Stage 1: Base ----
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ---- Stage 2: Dependency Fetcher ----
FROM base AS fetcher

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json

RUN pnpm fetch

# ---- Stage 3: Installer ----
FROM fetcher AS installer

ARG APP=web

COPY . .

RUN pnpm install --frozen-lockfile --offline
RUN pnpm turbo build --filter=@amdox/${APP}

# ---- Stage 4: Runner (Web - Next.js) ----
FROM gcr.io/distroless/nodejs20 AS runner-web

WORKDIR /app

COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["apps/web/server.js"]

# ---- Stage 4: Runner (API - NestJS) ----
FROM gcr.io/distroless/nodejs20 AS runner-api

WORKDIR /app

COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/apps/api/node_modules ./node_modules
COPY --from=installer /app/apps/api/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["dist/main.js"]
