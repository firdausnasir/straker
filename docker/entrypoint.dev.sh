#!/bin/sh
# Dev container entrypoint. Regenerate the Prisma client (schema may have
# changed since the image was built), apply migrations to the SQLite file,
# then run `next dev` with HMR. The source is bind-mounted, so edits reload
# without rebuilding the image.
set -e

echo "[dev] prisma generate..."
node_modules/.bin/prisma generate

echo "[dev] prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[dev] starting next dev (webpack) on 0.0.0.0:${PORT:-3000}..."
# --webpack (not the Next 16 default Turbopack): Turbopack ignores
# WATCHPACK_POLLING and its native watcher misses changes across a macOS
# Docker bind mount, so HMR breaks. webpack + polling reloads reliably.
# -H 0.0.0.0 so the dev server is reachable from the host port mapping.
exec node_modules/.bin/next dev --webpack -H 0.0.0.0 -p "${PORT:-3000}"
