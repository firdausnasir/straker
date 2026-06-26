# PRD — Collapse to single-layer PaymentAccount + default account

**Status:** ready for `write-plan`
**Tier:** B · Data Class D4 · Blast Radius B1 (per repo AGENTS.md)
**Source:** confirmed brainstorm output (this session); supersedes `plans/payment-accounts.prd.md`

## Problem Statement

The current data model has a two-layer payment structure — `PaymentAccount` (e.g.
"Maybank") → `Card[]` (e.g. "Personal Visa" ·4242) — and each commitment links to
a single `Card`. The user wants one flat layer: each row is just a **payment
account with a name and an optional last 4**, no card sub-layer, no `type`
classification. In addition, there must be a per-user **default account** that is
prefilled whenever a new commitment is created (overridable per row). The
accounts page, commitment-dialog picker, commitment-card meta, dashboard
filter, and analytics "by account" breakdown must all be redesigned to match the
new flat model under the Earthy Soft design system (ui-ux-pro-max,
frontend-design, make-interfaces-feel-better).

This is a breaking schema-and-data migration that drops the `Card` table, drops
`PaymentAccount.type` and `Card.network`, renames the commitment FK from `cardId`
to `accountId`, and adds a nullable `User.defaultAccountId`.

## Solution

One user-scoped domain entity (`PaymentAccount`) with two fields: `name` (1–60
chars, trimmed) and `last4` (null or exactly 4 digits). A single nullable FK on
`Commitment.accountId` traces to it. `User.defaultAccountId` (nullable,
`SetNull` on delete) stores the at-most-one default. Apply on create dialog for
every commitment type.

### Modules / subsystems

| Module | Build / modify | Interface |
|--------|----------------|-----------|
| `prisma/schema.prisma` | drop `Card` model, drop `PaymentAccount.type`, add `last4` to `PaymentAccount`, rename `Commitment.cardId` → `accountId` (FK → `PaymentAccount`, `SetNull`), add `User.defaultAccountId` | schema |
| `prisma/migrations/<ts>_collapse_payment_accounts/migration.sql` | bespoke SQL — back-fill `PaymentAccount` rows from old `Card`s, reattach commitments, then rebuild the tables | `prisma migrate deploy` |
| `src/lib/types.ts` | `PaymentAccountDTO` collapses to `{ id, name, last4 }`; `CardDTO` removed; `CommitmentDTO.card` → `CommitmentDTO.account: { id, name, last4 } \| null`; `CommitmentDTO.cardId` renamed → `accountId` | serializable shapes |
| `src/lib/constants.ts` | remove `ACCOUNT_TYPES`, `ACCOUNT_TYPE_LABELS`, `CARD_NETWORKS`, `CARD_NETWORK_LABELS`, `AccountType`, `CardNetwork` | const tuples are the source of truth |
| `src/lib/validation.ts` | replace `accountInputSchema`/`cardInputSchema` with one `accountInputSchema` (`name` + `last4`); update `commitmentInputSchema.cardId` → `accountId: z.cuid().nullable().optional()`; add `setDefaultSchema` (no body) | zod at every boundary |
| `src/lib/accounts.ts` | rewrite: `getAccounts(userId)` returns flat list; `getAccountForUser(userId, id)` ownership check; `getDefaultAccount(userId)`; `setDefaultAccount(userId, id)` (transaction: clear prior default, set new); `clearDefaultAccount(userId)` | deep module, simple read interface |
| `src/lib/commitments.ts` | `getActiveCommitments` include renamed `card: { include: { account } }` → `account`; `CommitmentWithCard` → `CommitmentWithAccount`. NOTE `getCommitmentsDueForReminder` includes only `{ user: true }` today (no card/account include) — leave untouched; the reminder route accesses no account fields. | pure read |
| `src/lib/analytics.ts` | `byAccount` keyed by `account.id` (no nested card) | reuse `money.ts` |
| `src/app/api/accounts/route.ts` | GET list (flat), POST create (`name` + `last4`) | auth-guarded |
| `src/app/api/accounts/[id]/route.ts` | PATCH (`name` + `last4`), DELETE (cascade SetNull commitments, clear default if default) | owner-scoped |
| `src/app/api/accounts/[id]/default/route.ts` (new) | POST = set as default, DELETE = clear default | auth-guarded |
| `src/app/api/accounts/[id]/cards/**` (deleted) | remove recursion — no nested cards | — |
| `src/app/api/commitments/route.ts` + `[id]/route.ts` | `cardId` → `accountId`; ownership check via `getAccountForUser`; preserve P2003 → 401 path | auth-guarded |
| `src/app/accounts/page.tsx` | pass flat `PaymentAccountDTO[]` + current default id | server component |
| `src/components/accounts/accounts-manager.tsx` | rewrite as flat list, default badge, set-default action, unset-default action (on the row currently marked default), single-row dialog | Earthy Soft redesign |
| `src/components/accounts/account-dialog.tsx` | two fields: name, last4 | Earthy Soft |
| `src/components/accounts/card-dialog.tsx` | delete | — |
| `src/components/accounts/confirm-delete-dialog.tsx` | keep, reuse | unchanged |
| `src/components/commitment-dialog.tsx` | single account picker prefilled from default; "default" not auto-saved — represent unset distinctly | Earthy Soft |
| `src/components/commitment-card.tsx` | meta row shows `account.name · last4` (or just `account.name` if no last4); remove CreditCard icon | Earthy Soft |
| `src/components/dashboard.tsx` | account filter keyed by `account.id`; "Unassigned" bucket | — |
| `src/app/analytics/page.tsx` | "By account" section keyed by new shape | — |
| `src/lib/types.ts` CommitmentDTO | new field name `accountId`/`account`, drop `cardId`/`card` | — |
| `tests/smoke.mjs` | rewrite accounts flow: single add/edit/delete; default prefill on commitment create; account delete SetNull verification | — |

## User Stories

1. As a user, I add a payment account with a name and an optional last 4 (no
   type, no network) — that's the whole record.
2. As a user, I edit an account's name and/or last 4.
3. As a user, I delete an account; any commitments linked to it stay, now
   unlinked; if it was my default, my default becomes unset.
4. As a user, I mark one account as my default. Setting a new default clears the
   prior one — at most one default at any time.
5. As a user, I unset my default (no default) and new commitments start with no
   account selected.
6. As a user, when creating any commitment (subscription / recurring / loan /
   other), the account picker is prefilled with my default account if one is
   set. I can keep it, pick a different account, or pick "No account" — the
   choice I see is the choice that saves.
7. As a user, I edit an existing commitment's account (or unlink it) without
   silently rewriting it to my default — the default prefill only applies on
   create, not edit.
8. As a user, I see the linked account name and last 4 on each commitment card.
9. As a user, I filter the Subs dashboard by account to see only what a given
   account pays; unlinked commitments group under "Unassigned".
10. As a user, I see a per-account monthly-normalized spend breakdown in
    Analytics, keyed by the new flat account shape.
11. As a user with an existing two-layer dataset, I open the app after the
    upgrade and each of my old cards is now a single payment account (name =
    the card's label, last4 = the card's last4); my commitments still point at
    the right account; bare old accounts with no cards survive with `last4 =
    null`. Old cards with `last4 = null` migrate to `last4 = null` (valid);
    cards whose labels collide across accounts or within one account become
    separate same-named `PaymentAccount` rows (no `(userId, name)` uniqueness);
    card labels longer than 60 chars cannot exist (Card.label cap was 60);
    cross-user migration is impossible (each Card's parent PaymentAccount was
    already owner-scoped in the old schema).
12. As a user who has **zero accounts** (e.g. brand-new, or after deleting the
    last one), when I open the create-commitment dialog I see an inline "Add
    account" affordance in the empty account picker so I can create one right
    there without leaving the dialog — and a "No account" option so I can save
    the commitment unlinked.

## Implementation Decisions

- **Single-layer PaymentAccount:** fields `name` (1–60 trim), `last4` (null or
  exactly 4 digits). No `type`, no `network`, no Card model. Zod rejects
  anything else. Never log `last4` (D4 PII floor preserved).
- **Commitment link:** `Commitment.accountId` (nullable) → `PaymentAccount.id`,
  `onDelete: SetNull`. Enforce at the Prisma schema layer, not only in app code.
- **Default account:** `User.defaultAccountId` nullable FK → `PaymentAccount.id`,
  `onDelete: SetNull`. At-most-one default falls out of the FK-on-User shape —
  no app-side `isDefault` boolean, no partial unique index needed (SQLite does
  not support them reliably).
- **Default prefill, no silent link:** the create dialog initialises its
  account-select to `defaultAccountId ?? "none"`. Saving posts exactly what the
  user sees — no server-side coercion to default. Edit dialog starts with the
  commitment's existing `accountId` (never the default). This makes "default"
  a UI hint, not a hidden write — matches "whenever I create new recurring,
  by default gonna use that if set" (overridable).
- **Zero-accounts affordance:** when the dialog's account list is empty, the
  picker shows an inline "Add account" action (opens `AccountDialog` in-place)
  alongside the "No account" option. Survives on the new-commitment dialog and
  the edit dialog alike so users with zero accounts never get stuck.
- **Default mutation API:** dedicated `POST /api/accounts/[id]/default` (sets
  new default, single update) + `DELETE /api/accounts/[id]/default` (clears
  it). Server-side `setDefaultAccount` runs a 2-step transaction (clear prior
  if any, set new) so the invariant holds even under concurrent callers.
  DELETE account also clears the default if the deleted row was it (enforced
  at the schema layer via `SetNull`).
- **Ownership:** every route handler self-checks `auth()` and scopes
  `updateMany`/`deleteMany` by `userId`. A foreign `accountId` supplied to the
  commitment create/update route is rejected: route verifies via
  `getAccountForUser(userId, id)` → 404 if not the caller's. Never trust body.
- **DTO shape:** `CommitmentDTO.account` is embedded `{ id, name, last4 } | null`
  so the commitment card + dashboard filter render without extra fetches. Server
  page maps it via a Prisma `include`.
- **Money:** per-account analytics reuses integer minor units + `money.ts`;
  per account *per currency* (no FX). Unlinked commitments group under
  "Unassigned" in filter + analytics.
- **Migration:** bespoke single SQL migration:
  1. Defer FKs.
  2. Create `new_PaymentAccount` with `(id, userId, name, last4, createdAt,
     updatedAt)`.
  3. Insert all old `Card` rows into `new_PaymentAccount` with `id = Card.id`,
     `name = Card.label`, `last4 = Card.last4`, `userId = parent_account.userId`.
     *Also* insert old bare `PaymentAccount` rows (those with 0 cards) with
     `last4 = null`. Dedupe on `id` (cards and accounts use disjoint id spaces —
     cuid collision-resistant, safe).
  4. Create `new_Commitment` with `accountId` instead of `cardId`, FK to
     `PaymentAccount`, `SetNull`.
  5. Insert old commitments: `accountId = old.cardId` (nullable; null stays
     null). The old `cardId` already references a `Card` whose id is now a
     `PaymentAccount` id — the link survives.
  6. Add `defaultAccountId` column to `User` (nullable).
  7. Drop old `Card` + old `PaymentAccount` + old `Commitment`; rename new
     tables; recreate indexes.
- The migration must be committed and run idempotently on a fresh
  `prisma migrate deploy`. No reversible down path — documented as one-way.
- **UI conventions:** the accounts page collapses to a flat single list (no
  expand). Each row shows name + optional last4 chip + default badge (if set)
  + set-default/edit/delete actions. The Earthy Soft tokens (`surface`, `tnum`,
  cobalt-ish accent, Fraunces display, cubic-bezier easing) carry over verbatim.
  The redesign explicitly invokes the three named skills (ui-ux-pro-max,
  frontend-design, make-interfaces-feel-better) at implement time.

## Testing Decisions

- **Proving command:** `npm run build` must pass clean across all touched files.
- **Smoke test rewrite:** `tests/smoke.mjs` replaces the two-layer flow:
  1. Register → create **Account A** (name + last4 "4242") → assert it renders
     on `/accounts` WITH a last4 chip. Mark **A** as default via the new "Set
     as default" action → assert A now carries the default badge.
  2. Create **Account B** (name only, **no** last4) → assert it renders WITHOUT
     a last4 chip (proves US8 render case). Mark **B** as default → assert B
     now carries the default badge AND A has **lost** its badge (this is the
     only way US4 "at-most-one" is provable — the prior default was A, not
     vacuous absence).
  3. Open new-commitment dialog; assert the account picker is prefilled with
     Account B (the default). Pick **Account A** instead, fill the rest, and
     save (covers "override default per row").
  4. Confirm that commitment appears on the dashboard with `A name ·4242` on
     the expanded commitment card.
  5. Edit the commitment from step 4: user default is B; commitment's existing
     account is A. Assert the edit dialog's picker starts on **A**, NOT B.
     Save without changes → assert server response's `accountId` is still A's
     id (proves US7 — edit must NOT silently flip to default).
  6. Navigate to `/accounts`. Use the **unset-default** affordance on Account B
     (only visible on the row currently marked default) → assert the default
     badge is gone (US5 via the dedicated `DELETE /api/accounts/[id]/default`
     endpoint). Then return to `/` and open the new-commitment dialog; assert
     its picker now starts on "No account" selected — B is still alive, so a
     "No account" prefill genuinely reflects the unset default.
  7. Re-set Account B as default. Delete **Account A** (the commitment's linked
     account) → confirm the step-4 commitment survives unlinked
     (`Commitment.accountId` → null, proving the schema `SetNull`), and the
     default is still B (unaffected by A's deletion).
  8. Delete Account B (the current default) → confirm the default is unset
     (`User.defaultAccountId` → null, proving the schema `SetNull`). The "No
     account" prefill rule was already proven in step 6 against a still-alive
     B; step 8 does NOT need to reopen the create dialog.
- **Cascade/SetNull verification:** smoke flow proves BOTH schema `SetNull`
  paths — deleting a linked account nulls its commitments (step 7), and deleting
  the default account nulls `User.defaultAccountId` (step 8) — declared behavior
  proven, not assumed.
- **Ownership:** proven at the route layer via build + smoke; no separate
  unit harness in repo (consistent with current practice, D4 / B1).

## Out of Scope

- Full PAN / CVV / expiry storage — forbidden (D4 floor).
- Network, type, or any sub-classification — explicitly dropped per
  confirmation in brainstorm.
- FX or cross-currency aggregation — repo has none by design.
- Editing any IA-platform money logic — unrelated (this is the personal tracker).
- Backfilling an old account as the new default — `defaultAccountId` starts null
  for all existing users; they opt into a default after upgrade.
- Reminders/notifications tied to accounts — unchanged.
- Sharing accounts across users — single-user app (B1).
- PWA service worker + push + cron routes — untouched.
- Reversible (`migrate dev` down) migration — one-way, documented.

## Further Notes

- The new `POST /api/accounts/[id]/default` and `DELETE` endpoints are tiny;
  keep handler logic in the transaction in `src/lib/accounts.ts`, route just
  validates auth + ownership and delegates.
- The default prefill must be implemented so that the dialog's initial form
  state reads `defaultAccountId` from props *once*, not from a live query. If
  the user changes their default while a dialog is open, the open dialog does
  not retroactively re-prefill — same behaviour as every other form default in
  the app.
- Commitment edit dialog **never** reads the default. Initial state is the
  commitment's existing `accountId` (never the default). Hard rule; protects US7.
- `tests/passkey-smoke.mjs` is untouched — only `tests/smoke.mjs` rewrites.
- `src/proxy.ts` matcher excludes all `/api/*` paths (verified) — so
  `/api/accounts/[id]/default` is correctly NOT proxy-gated and IS
  self-auth'd in-proc by `auth()` in the route handler. No proxy change needed.
- The campaign for the three design skills is at `write-plan` / `implement`
  time, not at PRD time — this PRD only commits to the Earthy Soft system
  constraint and the surface list.