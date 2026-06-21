#!/bin/sh
# Web container entrypoint. Apply committed migrations, then start the server.
# This is the local equivalent of Vercel running `prisma migrate deploy` at
# build time — here it runs once the db container is healthy.
set -e

echo "[entrypoint] Applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Starting Next.js on port ${PORT:-3000}..."
exec node server.js
