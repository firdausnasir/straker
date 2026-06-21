# syntax=docker/dockerfile:1

# Production image for the Next.js 16 app. CI builds this once and low-spec
# deploy hosts only pull/run it. Migrations still run at container start against
# the host-mounted SQLite DB (see docker/entrypoint.sh).

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
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Migration toolchain ----
FROM base AS migration-deps
# The standalone server carries traced app dependencies. Startup migrations only
# need the Prisma CLI and engines, so avoid copying every production dependency.
RUN --mount=type=cache,target=/root/.npm \
  npm install --omit=dev --ignore-scripts --no-audit --no-fund --no-save prisma@6.19.3

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` == `prisma generate && next build`
RUN npm run build

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
# Standalone runtime: traced Next server + minimal migration deps for Prisma
# migrations. This avoids shipping the full dev toolchain to small devices.
COPY --from=migration-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
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
