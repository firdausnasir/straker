# Straker — Commitment Tracker

Track subscriptions, recurring bills, and loans in one quiet ledger. Multi-currency
(MYR + USD, no exchange — each amount is exact in its own currency), with auto- or
manual-renewing cycles. Sign in, see everything sorted by what's due next, and
add a commitment in a couple of taps.

## Features

- Email + password auth (bcrypt hashes, JWT session in an httpOnly cookie)
- Commitments: subscriptions, recurring bills, loans, other
- Weekly / monthly / quarterly / yearly cycles
- **Auto-renew** — past-due dates roll forward on their own
- **Manual** — you advance it yourself when paid
- MYR + USD, stored as integer minor units (never float)
- Dashboard sorted by due date / amount / name, with overdue & due-soon coding
- Quick-add sheet, analytics (monthly-normalized totals per currency), settings
- **Liquid Glass UI** on shadcn/ui, with light + dark mode

## Getting started

```bash
npm install
cp .env.example .env        # then set a real AUTH_SECRET (>= 32 chars)
npx prisma db push          # create the SQLite database
npm run dev                 # http://localhost:3000
```

Generate a strong `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma + SQLite · Tailwind v4.
See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.
