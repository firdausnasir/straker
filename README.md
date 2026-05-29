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

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma + PostgreSQL
(Supabase) · NextAuth (Auth.js v5) · @simplewebauthn (passkeys) · Tailwind v4 ·
shadcn/ui · web-push.
See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.
