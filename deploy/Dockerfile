# Multi-stage production Dockerfile for Next.js 16 (standalone output)
FROM node:20.19-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# ── Stage 1: Dependencies ─────────────────────────────────────────────
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Stage 2: Builder ──────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Runner ───────────────────────────────────────────────────
FROM node:20.19-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system --gid 10001 nodejs \
    && adduser --system --uid 10001 nextjs \
    && mkdir -p /app/data \
    && chown -R nextjs:nodejs /app/data

# Copy built standalone app & static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/healthz || exit 1

CMD ["node", "server.js"]
