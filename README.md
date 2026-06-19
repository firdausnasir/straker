# Straker — Commitment Tracker

Track subscriptions, recurring bills, and loans in one quiet ledger. Multi-currency
(MYR + USD, no exchange — each amount is exact in its own currency), with auto- or
manual-renewing cycles. Sign in with a password or a passkey, see everything
sorted by what's due next, and add a commitment in a couple of taps. Installable
as a PWA with optional due-date push reminders.

## Features

- Email + password auth (bcrypt hashes, JWT session in an httpOnly cookie)
- **Passkey sign-in** (WebAuthn / Face ID, Touch ID, Windows Hello, security
  keys) — one passkey per account, with password kept as a fallback. Add, renew,
  and delete all re-prove the password; setup offers a guessed device name to
  confirm. Manage it in Settings.
- Commitments: subscriptions, recurring bills, loans, other
- Weekly / monthly / quarterly / yearly cycles
- **Auto-renew** — past-due dates roll forward daily via the advance-cycles cron
- **Manual** — you advance it yourself when paid
- MYR + USD, stored as integer minor units (never float)
- Dashboard sorted by due date / amount / name, with overdue & due-soon coding
- Quick-add dialog, analytics (monthly-normalized totals per currency), settings
- **Installable PWA** with **Web Push** due-date reminders — per-commitment,
  opt-in, configurable lead time (0–7 days), sent once per due date
- **Earthy Soft UI** on shadcn/ui — warm sand + parchment, terracotta accent,
  Fraunces/Inter type, with light + dark mode (follows device)

## Getting started

This app runs on SQLite — a single local file, no database server to run.

```bash
npm install
cp .env.example .env        # then fill in the vars below
npm run db:deploy           # apply migrations to the database file
npm run dev                 # http://localhost:3000
```

### Required environment

- `AUTH_SECRET` — **≥ 32 chars** or auth throws at startup. Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `DATABASE_URL` — SQLite file URL. Relative paths resolve against the
  `prisma/` directory, e.g. `file:./dev.db` for local development.
- `AUTH_URL` — public origin of the app, e.g. `https://commit.firdausnasir.cc`.
  **Required behind a reverse proxy**: Auth.js builds login/`callbackUrl` from
  the request host, which a proxy reports as the internal `localhost:3000`, so
  without `AUTH_URL` the callback points at localhost. Leave it unset for direct
  local access (it then uses the request host).

### Push reminders (optional)

Web Push needs VAPID keys and a cron secret. Generate them into `.env`
(idempotent, never prints values):

```bash
node scripts/setup-push-env.mjs
```

This sets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_SUBJECT`, and `CRON_SECRET`. Two scheduler endpoints, both guarded by
`Authorization: Bearer $CRON_SECRET`:

- `GET /api/cron/advance-cycles` — rolls lapsed auto-renew commitments forward
  (the only place auto dates advance). `vercel.json` runs it daily 16:10 UTC
  (00:10 MYT).
- `GET /api/cron/due-reminders` — sends due-date push reminders. Runs daily
  01:00 UTC (09:00 MYT), after advance-cycles in the MYT day so it scans fresh
  dates.

On Vercel the bearer is injected automatically. Self-host: hit both from system
cron —

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/advance-cycles
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/due-reminders
```

## Run with Docker

A single self-contained stack with **live reload**: the web container runs
`next dev` over a bind-mounted source (edits reflect immediately, no rebuild),
plus a scheduler replicating the two `vercel.json` crons. Both services restart
automatically unless you stop them manually (`restart: unless-stopped`).

```bash
cp .env.example .env        # set AUTH_SECRET (>=32 chars); push vars optional
docker compose up -d --build
# app on http://localhost:3001
```

- **Port** — host port is `WEB_PORT` (default `3001`), e.g. `WEB_PORT=8080 docker compose up -d`.
- **Live reload** — source is bind-mounted; just save a file and refresh.
  `node_modules` and `.next` live in named volumes (the host may be macOS, whose
  `node_modules` carries the wrong Linux/Prisma binaries — never bind-mount it
  in). File watching uses polling (`WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING`)
  since macOS bind mounts drop inotify events. After changing `package.json`,
  rebuild and recreate the volumes: `docker compose up -d --build -V`.
- **Database** — SQLite file at `/app/data/app.db` inside the web container,
  persisted on the `sqlite-data` volume. compose sets `DATABASE_URL` to it,
  overriding any value in `.env`. Migrations (`prisma migrate deploy`) run
  automatically on web container start.
- **Behind a reverse proxy** — set `AUTH_URL` to the public origin (e.g.
  `AUTH_URL=https://your.domain docker compose up -d`, or add it to `.env`).
  Otherwise the login `callbackUrl` falls back to the container's
  `localhost:3000`. compose forwards `AUTH_URL` to the web container.
- **Crons** — the `cron` service curls `advance-cycles` (16:10 UTC) and
  `due-reminders` (01:00 UTC) with the `CRON_SECRET` bearer, same schedules as
  Vercel. Push reminders also need the `VAPID_*` vars in `.env`.
- Logs: `docker compose logs -f web`. Stop: `docker compose down` (add `-v` to
  wipe the database volume).

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run db:migrate` — create/apply a migration in development
- `npm run db:deploy` — apply committed migrations to the database
- `npm run lint` — ESLint
- `npx prisma studio` — inspect the database
- `node tests/smoke.mjs` — Playwright end-to-end smoke test (run a server first)
- `node tests/passkey-smoke.mjs` — passkey lifecycle e2e via a CDP virtual
  authenticator: add → name → renew → sign in (run a server first)

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma + SQLite ·
NextAuth (Auth.js v5) · @simplewebauthn (passkeys) · Tailwind v4 ·
shadcn/ui · web-push.
See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.
