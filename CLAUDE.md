# Commitment Tracker

Personal finance tracker — subscriptions, recurring bills, loans. Multi-currency
(MYR, USD), no FX. Email/password auth, dashboard sorted by next due date.

- **Tier:** B (personal feature work)
- **Data Class:** D4 — stores password hashes + financial commitment amounts
- **Blast Radius:** B1 — single-user, local

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Prisma + PostgreSQL (Supabase). Runtime uses the **transaction pooler**
  (`DATABASE_URL`, port 6543, `?pgbouncer=true`); migrations use the **session
  pooler** (`DIRECT_URL`, port 5432) — DDL can't run through pgbouncer.
- Tailwind v4 · shadcn/ui (`src/components/ui/`) · lucide-react
- **Liquid Glass** design system — frosted translucent surfaces (`.glass`,
  `.glass-strong`), teal/aqua brand mapped onto shadcn `--primary`, system SF
  font. Light + dark mode toggled by a `.dark` class on `<html>` (no-flash
  inline script in `layout.tsx`; `useTheme` via `useSyncExternalStore` reads it).
- Auth: **NextAuth (Auth.js v5)**, Credentials provider, JWT sessions.
  `src/auth.ts` (full, Prisma + bcrypt via `src/lib/password.ts`) + edge-safe
  `src/auth.config.ts` (shared with the proxy). Registration is at
  `/api/register` (Auth.js owns `/api/auth/*`). `trustHost: true` for self-host.
- Route protection: `src/proxy.ts` (Next 16 middleware) runs Auth.js's
  `authorized` callback — optimistic redirect to `/login`. API routes also
  self-check via `auth()`; the create route catches Prisma P2003 (token valid
  but user gone) → 401, and the client signs out on 401.
- Pages: `/` Subs · `/analytics` (monthly-normalized totals per currency) ·
  `/settings` · `/login`. Bottom glass tab dock (`src/components/tab-bar.tsx`),
  full-width on mobile. Mobile-first: ≥44px tap targets across primitives.
- Theme follows device by default (`system`), live via `matchMedia`; override
  to light/dark in Settings. `useTheme` (`src/components/theme.tsx`).
- Tests: `tests/smoke.mjs` — Playwright end-to-end (register → add → sort →
  date picker). Run a prod/dev server, then `node tests/smoke.mjs`.

## Money rule (non-negotiable)

Amounts are **integer minor units** (`amountMinor`) + ISO-4217 code. Never float.
Conversion + formatting live in `src/lib/money.ts`. No FX — each amount is exact
in its own currency.

## Layout

- `src/lib/` — domain logic: `constants`, `money`, `cycle`, `dates`, `auth`,
  `validation` (zod at every API boundary), `commitments` (auto-renew + query)
- `src/app/api/` — route handlers (auth, commitments CRUD, renew)
- `src/components/` — client UI (dashboard, card, quick-add dialog)

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (proving command)
- `npx prisma studio` — inspect the DB
- `npx prisma migrate deploy` — apply committed migrations to the DB
- `npx prisma migrate status` — show which migrations are applied

## PWA + Web Push

- Installable PWA: `src/app/manifest.ts` (Next metadata route) + brand icons in
  `public/icons/` (regenerate with `node scripts/generate-icons.mjs`).
- Service worker `public/sw.js` handles **push + notificationclick only** — no
  fetch caching on purpose (a finance app must never show stale due dates).
  Registered client-side by `src/components/pwa/service-worker-register.tsx`.
- Reminders are **per-commitment** (`reminderEnabled` + `reminderLeadDays`, 0–7;
  0 = remind on the due date itself), sent **once per due date** via the
  `reminderSentForDueDate` gate (re-arms when
  the date advances). Device must be enabled in Settings → Notifications to receive.
- Send lib: `src/lib/push.ts` (`sendPushToUser`, prunes 404/410). Endpoints are
  bearer secrets — never log endpoint/keys/payload.
- Secrets: `node scripts/setup-push-env.mjs` generates VAPID keys + `CRON_SECRET`
  into `.env` (idempotent, never prints values). Required vars: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
  Replicate them on the deploy host.
- Scheduler: `GET /api/cron/due-reminders` guarded by `Authorization: Bearer
  $CRON_SECRET`. `vercel.json` cron runs it daily 01:00 UTC (09:00 MYT) and Vercel
  injects the bearer automatically. Self-host: hit it from system cron —
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/due-reminders`.

## Notes

- AUTO commitments auto-advance past-due dates on dashboard load
  (`getActiveCommitments`). MANUAL ones advance only via the renew action.
- `AUTH_SECRET` must be ≥ 32 chars or auth flows throw at startup.
