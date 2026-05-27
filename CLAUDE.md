# Commitment Tracker

Personal finance tracker — subscriptions, recurring bills, loans. Multi-currency
(MYR, USD), no FX. Email/password auth, dashboard sorted by next due date.

- **Tier:** B (personal feature work)
- **Data Class:** D4 — stores password hashes + financial commitment amounts
- **Blast Radius:** B1 — single-user, local

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Prisma + SQLite (`prisma/dev.db`)
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
- `npx prisma db push` — sync schema to SQLite

## Notes

- AUTO commitments auto-advance past-due dates on dashboard load
  (`getActiveCommitments`). MANUAL ones advance only via the renew action.
- `AUTH_SECRET` must be ≥ 32 chars or auth flows throw at startup.
