# Straker — Commitment Tracker

Track subscriptions, recurring bills, and loans in one quiet ledger. Multi-currency
(MYR + USD, no exchange — each amount is exact in its own currency), with auto- or
manual-renewing cycles. Sign in, see everything sorted by what's due next, and
add a commitment in a couple of taps. Installable as a PWA with optional
due-date push reminders.

## Features

- Email + password auth (bcrypt hashes, JWT session in an httpOnly cookie)
- Commitments: subscriptions, recurring bills, loans, other
- Weekly / monthly / quarterly / yearly cycles
- **Auto-renew** — past-due dates roll forward on dashboard load
- **Manual** — you advance it yourself when paid
- MYR + USD, stored as integer minor units (never float)
- Dashboard sorted by due date / amount / name, with overdue & due-soon coding
- Quick-add dialog, analytics (monthly-normalized totals per currency), settings
- **Installable PWA** with **Web Push** due-date reminders — per-commitment,
  opt-in, configurable lead time (0–7 days), sent once per due date
- **Liquid Glass UI** on shadcn/ui, with light + dark mode (follows device)

## Getting started

This app runs on PostgreSQL (Supabase in production; any Postgres works locally).

```bash
npm install
cp .env.example .env        # then fill in the vars below
npm run db:deploy           # apply migrations to the database
npm run dev                 # http://localhost:3000
```

### Required environment

- `AUTH_SECRET` — **≥ 32 chars** or auth throws at startup. Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `DATABASE_URL` — pooled connection used at runtime (Supabase transaction
  pooler, port `6543`, `?pgbouncer=true`).
- `DIRECT_URL` — direct connection used for migrations (Supabase session
  pooler, port `5432`). DDL can't run through pgbouncer.

### Push reminders (optional)

Web Push needs VAPID keys and a cron secret. Generate them into `.env`
(idempotent, never prints values):

```bash
node scripts/setup-push-env.mjs
```

This sets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_SUBJECT`, and `CRON_SECRET`. The scheduler endpoint
`GET /api/cron/due-reminders` is guarded by `Authorization: Bearer $CRON_SECRET`.
On Vercel, `vercel.json` runs it daily at 01:00 UTC (09:00 MYT) and injects the
bearer automatically. Self-host: hit it from system cron —

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/due-reminders
```

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (runs `prisma generate` first)
- `npm run db:migrate` — create/apply a migration in development
- `npm run db:deploy` — apply committed migrations to the database
- `npm run lint` — ESLint
- `npx prisma studio` — inspect the database
- `node tests/smoke.mjs` — Playwright end-to-end smoke test (run a server first)

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma + PostgreSQL
(Supabase) · NextAuth (Auth.js v5) · Tailwind v4 · shadcn/ui · web-push.
See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.
