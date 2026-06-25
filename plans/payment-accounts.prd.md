# PRD — Payment Accounts & Cards

**Status:** ready for `write-plan`
**Tier:** B · Data Class D4 · Blast Radius B1 (per repo CLAUDE.md)
**Source:** confirmed brainstorm output (this session)

## Problem Statement

Commitments currently carry no information about *how* they are paid. A user
tracking a dozen subscriptions and bills cannot see which card or account each
one draws from, cannot group spend by account, and cannot answer "what's on my
Maybank card." The tracker needs a payment-account domain so each commitment can
optionally be tied to a specific card, and so accounts/cards can be managed,
displayed, filtered, and totalled.

## Solution

Introduce two user-scoped domain entities and an optional link from commitments:

- **PaymentAccount** — a funding source (e.g. "Maybank"), with a `name` and a
  `type` (`bank` | `credit` | `ewallet` | `cash`). Has many cards.
- **Card** — a card under one account, with a `label` (e.g. "Personal Visa"),
  an optional `last4`, and an optional `network`. **Never** stores a full PAN,
  CVV, or expiry — D4 PII floor.
- **Commitment.cardId** — nullable FK to a Card. A commitment links to one
  specific card; the card determines the account. Existing commitments remain
  unlinked (null) — nullable column, no backfill.

Users manage accounts and cards on a new dedicated `/accounts` page, reached
from a new 4th tab in the bottom dock. The commitment dialog gains an optional
account→card picker. The commitment card shows the linked account/card in its
meta row. The Subs dashboard gains an account filter. Analytics gains a
per-account monthly-normalized breakdown.

### Modules / subsystems

| Module | Build / modify | Interface |
|--------|----------------|-----------|
| Prisma schema + migration | new `PaymentAccount`, `Card` models; `Commitment.cardId` | `prisma migrate dev` |
| `src/lib/constants.ts` | add `ACCOUNT_TYPES` tuple + `ACCOUNT_TYPE_LABELS` | const tuples (source of truth for zod + UI) |
| `src/lib/validation.ts` | add account + card zod schemas | parse at every new API boundary |
| `src/lib/types.ts` | add `PaymentAccountDTO`, `CardDTO`; extend `CommitmentDTO` with `cardId`, `card` summary | serializable shapes |
| `src/lib/accounts.ts` (new) | `server-only` queries: list accounts+cards for user, ownership-checked card lookup | deep module, simple read interface |
| `src/app/api/accounts/**` (new) | CRUD route handlers (account + nested card) | `auth()`-guarded, zod-validated |
| `src/app/accounts/page.tsx` (new) | server page → client management UI | mirrors existing page pattern |
| `src/components/accounts/*` (new) | client CRUD UI (account list, card list, dialogs) | follows Earthy Soft + shadcn |
| `src/components/tab-bar.tsx` | add 4th tab (`/accounts`) | must keep ≥44px tap targets on mobile |
| `src/components/commitment-dialog.tsx` | add optional account→card picker | posts `cardId` |
| `src/components/commitment-card.tsx` | show account/card in meta row | reads `card` summary off DTO |
| `src/components/dashboard.tsx` | account filter control | client-side filter over DTO list |
| `src/lib/analytics.ts` + `src/app/analytics/page.tsx` | add `byAccount` breakdown | reuse `money.ts`, no FX |
| `src/proxy.ts` | confirm `/accounts` is protected | Auth.js `authorized` |

## User Stories

1. As a user, I create a payment account with a name and type so I can group my cards.
2. As a user, I add one or more cards (label + optional last4 + network) to an account.
3. As a user, I edit and delete accounts and cards.
4. As a user, when adding/editing a commitment, I optionally pick which card pays for it (choose account, then a card under it).
5. As a user, I see the linked account/card on each commitment card.
6. As a user, I filter the Subs dashboard by account to see only what a given account pays.
7. As a user, I view a per-account monthly-normalized spend breakdown in Analytics.
8. As a user, when I delete a card, my commitments survive (they become unlinked).
9. As a user, when I delete an account, its cards are removed and the affected commitments become unlinked.

## Implementation Decisions

- **Link granularity:** `Commitment.cardId` (nullable) → `Card`. No separate
  `paymentAccountId` on the commitment — the account is derived through the card.
  Filtering/grouping by account aggregates across that account's cards.
- **Delete semantics:** `Card` → `Commitment.cardId` is `onDelete: SetNull`.
  `PaymentAccount` → `Card` is `onDelete: Cascade`. Deleting an account cascades
  to its cards, each of which set-nulls its commitments. No commitment data loss.
  Enforce at the **Prisma schema layer**, not only in app code.
- **Ownership:** `PaymentAccount.userId` and `Card` (via its account) are
  user-scoped. Every API handler self-checks `auth()` and verifies the
  account/card belongs to the session user before mutating — reject cross-user
  IDs with 404. The commitment create/update route must verify a supplied
  `cardId` resolves to a card the user owns (else 400/404), never trust the body.
- **No regulated card data:** Card schema permits only `label`, `last4`
  (optional, exactly 4 digits when present), `network` (optional, from a small
  known set). Zod rejects anything longer. Never log card fields.
- **DTO shape:** `CommitmentDTO` gains `cardId: string | null` and an embedded
  `card: { id, label, last4, network, accountId, accountName } | null` summary so
  the commitment card and dashboard filter render without extra fetches. Server
  page maps it via a Prisma `include`.
- **Money:** per-account analytics reuses integer minor units + `money.ts`
  normalization; currencies never mixed (no FX) — breakdown is per account *per
  currency*, consistent with existing `byCurrency`. Unlinked commitments group
  under an "Unassigned" bucket in filter and analytics.
- **Constants as source of truth:** `ACCOUNT_TYPES` + `NETWORKS` const tuples in
  `constants.ts`, reused by zod enums and the UI (matches existing
  `COMMITMENT_TYPES`/`CURRENCIES` pattern).
- **Migration:** additive SQLite migration — two new tables + one nullable
  column + FK. No data backfill. Commit the migration.
- **UI conventions:** new page + components follow Earthy Soft design system,
  shadcn primitives, `next/font` type, ≥44px tap targets, light/dark. New tab
  uses a lucide icon (e.g. `CreditCard`).

## Testing Decisions

- **Proving command:** `npm run build` (repo's declared proving command) must
  pass clean — covers TypeScript + Next build across all touched files.
- **Smoke test:** extend `tests/smoke.mjs` (Playwright) with a flow: create
  account → add card → add commitment linked to the card → assert it shows on the
  dashboard → delete the card → assert the commitment survives unlinked. Reuses
  the existing register→add→sort harness.
- **Cascade/SetNull verification:** explicitly verify (via the smoke flow or
  `prisma studio`/a scripted check) that deleting an account removes its cards and
  null-links commitments, and deleting a card null-links without deleting the
  commitment — declared behavior must be proven, not assumed.
- **Ownership:** validation that a foreign `cardId` is rejected is covered at the
  zod/route layer; no separate unit-test harness exists in the repo, so this is
  proven through the route logic + build, consistent with current practice.

## Out of Scope

- Full PAN / CVV / expiry storage — explicitly forbidden (D4 floor).
- Any FX or cross-currency aggregation — repo has no FX by design.
- Editing commission/payout or any IA-platform money logic — this is the
  personal tracker, unrelated.
- Backfilling existing commitments to a default account — link stays optional/null.
- Per-card analytics (only per-account was requested).
- Reminders/notifications tied to accounts — unchanged.
- Sharing accounts across users — single-user app (B1).

## Further Notes

- The bottom dock goes from 3 to 4 tabs; mobile layout uses `flex-1` per tab, so
  spacing auto-distributes — but tap-target height (≥44px / current `min-h-[52px]`)
  and label legibility at 4-up must be checked on a narrow viewport.
- `getActiveCommitments` currently returns bare Prisma rows; adding the `card`
  include touches both the dashboard and analytics server pages that consume it —
  keep the include shape consistent across both call sites.
- AUTO-advance cron and reminder logic are untouched; the new column is ignored
  by those paths.
