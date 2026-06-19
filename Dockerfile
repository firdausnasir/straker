# syntax=docker/dockerfile:1

# Production image for the Next.js 16 app. Mirrors the Vercel build
# (`prisma generate && next build`); migrations run at container start
# (see docker/entrypoint.sh), matching Vercel's build-time `migrate deploy`.

# ---- Base: Node + OpenSSL (Prisma's query engine links against libssl) ----
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Dependencies (layer caches on the lockfile) ----
FROM base AS deps
COPY package.json package-lock.json ./
# prisma/schema.prisma must exist before `npm ci`: the postinstall hook
# runs `prisma generate`.
COPY prisma ./prisma
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` == `prisma generate && next build`
RUN npm run build

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
# Full (non-standalone) runtime: `next start` + the Prisma CLI for migrations.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# Data dir for the SQLite file — owned by `node` so a fresh named volume
# mounted here inherits node ownership and stays writable.
RUN mkdir -p /app/data \
  && chmod +x /usr/local/bin/entrypoint.sh \
  && chown -R node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# ---- Dev (live reload) ----
# Built by docker-compose.dev.yml. Carries only deps + toolchain; the source
# is bind-mounted at runtime so edits hot-reload without a rebuild. Runs as
# root to avoid bind-mount/volume permission friction (dev only).
FROM deps AS dev
ENV NODE_ENV=development
COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.dev.sh
RUN mkdir -p /app/data && chmod +x /usr/local/bin/entrypoint.dev.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.dev.sh"]
