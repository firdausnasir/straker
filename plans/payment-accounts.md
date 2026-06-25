# Implementation Plan — Payment Accounts & Cards

**PRD:** `./plans/payment-accounts.prd.md`
**Tier:** B · D4 · B1
**Repo proving command:** `npm run build` (TypeScript + Next build, all files)

## Execution contract

### Task graph

```
Wave 1 (blocking foundation, single owner)
  T1 ─ schema + migration + constants + validation + types + accounts lib + commitments include

Wave 2 (parallel-independent, disjoint files — all depend on T1)
  T2 ─ accounts CRUD API           (api/accounts/**)
  T3 ─ /accounts page + dock tab   (app/accounts, components/accounts, tab-bar.tsx)   [runtime dep: T2 contract]
  T4 ─ dialog picker + cardId      (commitment-dialog.tsx, api/commitments routes)    [runtime dep: T2 contract]
  T5 ─ commitment-card display     (commitment-card.tsx)
  T6 ─ dashboard filter            (app/page.tsx, components/dashboard.tsx)
  T7 ─ analytics breakdown         (lib/analytics.ts, app/analytics/page.tsx)

Wave 3 (integration, single owner)
  T8 ─ smoke test + full-flow verify   (tests/smoke.mjs)
```

### Ownership boundaries (no two parallel tasks share an unstable file)

- **T1:** `prisma/schema.prisma`, `prisma/migrations/**`, `src/lib/constants.ts`, `src/lib/validation.ts`, `src/lib/types.ts`, `src/lib/accounts.ts` (new), `src/lib/commitments.ts`
- **T2:** `src/app/api/accounts/**` (all new)
- **T3:** `src/app/accounts/**` (new), `src/components/accounts/**` (new), `src/components/tab-bar.tsx`
- **T4:** `src/components/commitment-dialog.tsx`, `src/app/api/commitments/route.ts`, `src/app/api/commitments/[id]/route.ts`
- **T5:** `src/components/commitment-card.tsx`
- **T6:** `src/app/page.tsx`, `src/components/dashboard.tsx`
- **T7:** `src/lib/analytics.ts`, `src/app/analytics/page.tsx`
- **T8:** `tests/smoke.mjs`

`src/lib/commitments.ts` is owned solely by T1 (adds the `card` include); T6 and T7 only *consume* the now-present field via their own server-page DTO mapping. No overlap.

### Chosen execution pattern

**parallel-waves.** T1 is a hard barrier. T2–T7 run in parallel on disjoint files. T3 and T4 have a *runtime* dependency on T2's API but no *file* overlap and no *build* dependency (they fetch at runtime); T2's contract is fully specified below so they build against it. T8 runs last for end-to-end proof.

---

## T1 — Foundation: schema, migration, domain vocab, validation, DTO, accounts lib

**Objective:** Land the data model and all shared domain code so every Wave-2 task compiles against a stable base.

**Context:** SQLite + Prisma; enums are string columns validated by zod against const tuples in `constants.ts` (see existing `COMMITMENT_TYPES`/`CURRENCIES`). DTOs in `types.ts` are serializable shapes mapped in server pages. `getActiveCommitments` in `commitments.ts` returns bare Prisma rows consumed by `app/page.tsx` and `app/analytics/page.tsx`.

**Inputs / dependencies:** PRD. None upstream.

**Parallelizable:** no (blocks Wave 2).

**Isolation boundary:** only the T1-owned files listed above.

**Steps:**
1. `prisma/schema.prisma`:
   - `model PaymentAccount { id cuid, userId, user relation onDelete Cascade, name String, type String, createdAt, updatedAt, cards Card[], @@index([userId]) }`.
   - `model Card { id cuid, accountId, account PaymentAccount relation onDelete Cascade, label String, last4 String?, network String?, createdAt, updatedAt, commitments Commitment[], @@index([accountId]) }`.
   - On `Commitment`: add `cardId String?` + `card Card? @relation(fields:[cardId], references:[id], onDelete: SetNull)`; add `@@index([cardId])`.
   - On `User`: add `paymentAccounts PaymentAccount[]`.
2. Generate migration: `npx prisma migrate dev --name payment_accounts`. Confirm SetNull + Cascade emitted in the SQL.
3. `src/lib/constants.ts`: add `ACCOUNT_TYPES = ["bank","credit","ewallet","cash"] as const` + `AccountType`; `ACCOUNT_TYPE_LABELS`; `CARD_NETWORKS = ["visa","mastercard","amex","other"] as const` + `CardNetwork`; `CARD_NETWORK_LABELS`.
4. `src/lib/validation.ts`: `accountInputSchema` (name trimmed 1–60, type enum); `cardInputSchema` (label trimmed 1–60, last4 optional `/^\d{4}$/`, network optional enum); `accountUpdateSchema`/`cardUpdateSchema` as `.partial()`; extend `commitmentInputSchema` + `commitmentUpdateSchema` with `cardId: z.cuid().optional().nullable()`.
5. `src/lib/types.ts`: add `CardDTO`, `PaymentAccountDTO` (with `cards: CardDTO[]`); extend `CommitmentDTO` with `cardId: string | null` and `card: { id, label, last4, network, accountId, accountName } | null`.
6. `src/lib/accounts.ts` (new, `server-only`): `getAccountsWithCards(userId)` → accounts with nested cards ordered by name; `getCardForUser(userId, cardId)` → ownership-checked single card or null.
7. `src/lib/commitments.ts`: add `include: { card: { include: { account: true } } }` to `getActiveCommitments`. **Critical — change its return type**: it is currently hard-typed `Promise<Commitment[]>`, so an `include` alone leaves `card`/`cardId` absent from the TS type and every consumer (T6/T7) fails `npm run build`. Define and export `type CommitmentWithCard = Prisma.CommitmentGetPayload<{ include: { card: { include: { account: true } } } }>` and change the signature to `Promise<CommitmentWithCard[]>`. (`CommitmentWithUser` next to it is the existing pattern to mirror.)

**Acceptance criteria:**
- Migration applies cleanly; `npx prisma migrate status` shows it applied.
- Generated SQL has `ON DELETE SET NULL` for `Commitment.cardId` and `ON DELETE CASCADE` for `Card.accountId` and `PaymentAccount.userId`.
- `npm run build` passes (Prisma client regenerated, no type errors).
- No full PAN/CVV/expiry field anywhere; `last4` is exactly-4-digits-or-absent.

**Verification:** `npx prisma migrate dev --name payment_accounts` → `npx prisma migrate status` → `npm run build`; inspect the new migration SQL for the two delete rules.

---

## T2 — Payment accounts CRUD API

**Objective:** REST handlers to create/list/update/delete accounts and their cards, all user-scoped and zod-validated.

**Context:** Mirrors `src/app/api/commitments/route.ts` — `auth()` guard, `safeParse`, P2003 → 401. Cascade/SetNull are handled by Prisma on delete (T1 schema).

**Inputs / dependencies:** T1 (validation schemas, `accounts.ts`).

**Parallelizable:** yes.

**Isolation boundary:** `src/app/api/accounts/**` only (all new files).

**Steps:**
1. `api/accounts/route.ts`: `GET` → `getAccountsWithCards(userId)`; `POST` → create account (`accountInputSchema`).
2. `api/accounts/[id]/route.ts`: `PATCH` (accountUpdateSchema) + `DELETE` — both verify the account `.userId === session.user.id` before mutating, else 404.
3. `api/accounts/[id]/cards/route.ts`: `POST` add card (verify parent account ownership; `cardInputSchema`).
4. `api/accounts/[id]/cards/[cardId]/route.ts`: `PATCH` + `DELETE` card (verify card→account→user ownership).
5. Never log card fields. Return JSON `{ error }` with 400/401/404 consistent with the commitments route.

**API contract (consumed by T3/T4):**
- `GET /api/accounts` → `{ accounts: PaymentAccountDTO[] }`
- `POST /api/accounts` `{ name, type }` → 201 `{ account }`
- `PATCH /api/accounts/:id` `{ name?, type? }` → 200
- `DELETE /api/accounts/:id` → 200
- `POST /api/accounts/:id/cards` `{ label, last4?, network? }` → 201 `{ card }`
- `PATCH /api/accounts/:id/cards/:cardId` `{ label?, last4?, network? }` → 200
- `DELETE /api/accounts/:id/cards/:cardId` → 200

**Acceptance criteria:**
- All routes reject unauthenticated (401) and cross-user IDs (404).
- Invalid body → 400 with first zod message.
- `npm run build` passes.

**Verification:** `npm run build`; manual `curl`/Playwright in T8 exercises the live flow.

---

## T3 — /accounts page, management UI, 4th dock tab

**Objective:** Dedicated page to CRUD accounts + cards, reachable from a new bottom-dock tab.

**Context:** Earthy Soft design system, shadcn primitives, `next/font`, ≥44px tap targets, light/dark. Existing pages (`analytics/page.tsx`) show the server-page + `AppHeader` + `TabBar` pattern. Settings holds prior art for client management components (`passkey-settings.tsx`).

**Inputs / dependencies:** T1 (DTOs, `getAccountsWithCards`); T2 (API contract above).

**Parallelizable:** yes.

**Isolation boundary:** `src/app/accounts/**` (new), `src/components/accounts/**` (new), `src/components/tab-bar.tsx`.

**Steps:**
1. `app/accounts/page.tsx`: server component — `auth()` guard + redirect, fetch `getAccountsWithCards`, render `AppHeader` + client UI + `TabBar`.
2. `components/accounts/accounts-manager.tsx` (client): list accounts (type icon, name), each expandable to its cards; add/edit/delete account dialogs and add/edit/delete card dialogs; calls the T2 endpoints; `router.refresh()` on success; `signOut` on 401 (match `commitment-card.tsx`).
3. Card display shows `label` + `network` + `·last4` when present.
4. `tab-bar.tsx`: add `{ href: "/accounts", label: "Cards", icon: CreditCard }` (lucide). Keep `flex-1` + `min-h-[52px]`; confirm 4-up fits a 360px viewport.
5. Empty states for zero accounts / account with zero cards.
6. Confirm `/accounts` is route-protected: read `src/proxy.ts` and verify the Auth.js `authorized` matcher covers `/accounts` (it protects all non-public routes by default). If a path allowlist exists, add `/accounts`. No code change expected — verify and note.

**Acceptance criteria:**
- `/accounts` lists, creates, edits, deletes accounts and cards.
- `/accounts` redirects to `/login` when unauthenticated (proxy + server-page guard).
- Dock shows 4 tabs; active highlight + spinner still work; tap targets ≥44px at 360px width.
- `npm run build` passes.

**Verification:** `npm run build`; visual check at narrow viewport (noted in T8 smoke flow for create-account/add-card).

---

## T4 — Commitment dialog account→card picker + cardId on routes

**Objective:** Let users optionally choose a card for a commitment; persist `cardId` on create/update.

**Context:** `commitment-dialog.tsx` is the shared create/edit form; it POSTs/PATCHes the commitments routes. The picker is two-step: pick account, then a card under it (or "None").

**Inputs / dependencies:** T1 (validation `cardId`, DTO `card`); T2 (`GET /api/accounts` for picker options).

**Parallelizable:** yes.

**Isolation boundary:** `src/components/commitment-dialog.tsx`, `src/app/api/commitments/route.ts`, `src/app/api/commitments/[id]/route.ts`.

**Steps:**
1. Dialog: on open, fetch `GET /api/accounts`; render an optional account `Select` then a dependent card `Select` (disabled until account chosen; includes a "No card" clear option). Pre-select from `commitment.card` in edit mode.
2. Include `cardId` (or `null`) in the POST/PATCH body.
3. `api/commitments/route.ts` POST + `[id]/route.ts` PATCH: when `cardId` present, verify via `getCardForUser(userId, cardId)`; reject foreign/unknown card with 400 (`"Unknown card"`). Persist `cardId`.
   - **Mechanical detail — PATCH does NOT spread the input**: `[id]/route.ts` builds its `data` object field-by-field with `if (input.X !== undefined)` guards. Add an explicit branch: `if (input.cardId !== undefined) data.cardId = input.cardId;` (a literal `null` clears the link; SetNull relation allows it). Do not assume the existing builder picks `cardId` up automatically. POST sets `cardId: input.cardId ?? null` in its `create` data block.

**Acceptance criteria:**
- Creating/editing a commitment with a chosen card persists `cardId`; choosing "No card" clears it.
- A `cardId` not owned by the user is rejected 400, never written.
- `npm run build` passes.

**Verification:** `npm run build`; T8 smoke covers create-with-card → persisted.

---

## T5 — Show linked account/card on the commitment card

**Objective:** Surface the linked account/card name in the commitment card meta row.

**Context:** `commitment-card.tsx` renders `CommitmentDTO`. After T1, DTO carries `card: { label, network, last4, accountName } | null`.

**Inputs / dependencies:** T1 (DTO `card` field).

**Parallelizable:** yes.

**Isolation boundary:** `src/components/commitment-card.tsx`.

**Steps:**
1. In the meta row (row 2), when `commitment.card` is set, render a compact label e.g. `{accountName} ·{last4}` (fall back to `card.label` when no last4), styled as muted, consistent with the existing cycle/renewal text.
2. When `card` is null, render nothing extra (unlinked).
3. Keep the row's truncation/layout intact on mobile.

**Acceptance criteria:**
- Linked commitments show the account/card; unlinked show no card text.
- No layout overflow at narrow width.
- `npm run build` passes.

**Verification:** `npm run build`; T8 smoke asserts the card text appears for a linked commitment.

---

## T6 — Dashboard filter by account

**Objective:** Filter the Subs dashboard to one account (aggregating its cards), with an "All" and "Unassigned" option.

**Context:** `app/page.tsx` (server) maps Prisma rows → `CommitmentDTO[]` and renders `Dashboard` (client). T1 added the `card` include, so the server map must now also emit `cardId` + `card`. Filtering is client-side over the DTO list.

**Inputs / dependencies:** T1 (DTO + `getActiveCommitments` include).

**Parallelizable:** yes.

**Isolation boundary:** `src/app/page.tsx`, `src/components/dashboard.tsx`.

**Steps:**
1. `app/page.tsx`: extend the DTO map to include `cardId: c.cardId` and `card: c.card && { id, label, last4, network, accountId: c.card.accountId, accountName: c.card.account.name }`.
2. `dashboard.tsx`: derive the set of accounts present from the commitments; render a filter control (`Select` or pill row) with `All accounts`, each account, and `Unassigned`; filter the rendered list by the chosen account (a commitment matches if its `card.accountId` equals the selection; `Unassigned` matches `card == null`).
3. Default `All`. Filter is presentation-only; no refetch.

**Acceptance criteria:**
- Selecting an account shows only its commitments; `Unassigned` shows null-card ones; `All` shows everything.
- `npm run build` passes.

**Verification:** `npm run build`; T8 smoke optionally toggles the filter.

---

## T7 — Per-account analytics breakdown

**Objective:** Add a per-account monthly-normalized spend section to Analytics, alongside the existing per-currency/by-type sections.

**Context:** `lib/analytics.ts::computeAnalytics` produces `byCurrency`/`byType` from a DTO-like list using `money.ts` normalization (no FX). `analytics/page.tsx` maps Prisma rows → that list and renders sections.

**Inputs / dependencies:** T1 (DTO `card`, `getActiveCommitments` include).

**Parallelizable:** yes.

**Isolation boundary:** `src/lib/analytics.ts`, `src/app/analytics/page.tsx`.

**Steps:**
1. `analytics.ts`: add a `byAccount` aggregation — group commitments by account (via `card.account`), bucket null-card under `"Unassigned"`, sum monthly-normalized minor units **per currency within each account** (never mix currencies, mirror `byCurrency`'s exponent handling). Extend the return type.
2. `analytics/page.tsx`: extend the existing row→DTO map (the one that already casts `cycle: c.cycle as never`, `renewalMode: c.renewalMode as never`) to also emit `cardId: c.cardId` and the `card` summary object — `computeAnalytics` groups on `CommitmentDTO.card`, so the field must be on the mapped DTO. Add a "By account" section rendering each account's per-currency monthly figure with `formatMoney`, following the existing section styling.
3. Empty/zero handled like the existing zero-state.

**Acceptance criteria:**
- Analytics shows a per-account breakdown; amounts use integer minor units + `formatMoney`; currencies never mixed.
- Unassigned bucket present when null-card commitments exist.
- `npm run build` passes.

**Verification:** `npm run build`; visual check; T8 build gate.

---

## T8 — Integration: smoke test + full-flow verification

**Objective:** Prove the feature end-to-end and that delete semantics behave (card delete unlinks, account delete cascades+unlinks).

**Context:** `tests/smoke.mjs` is Playwright e2e (register → add → sort → date picker), run against a started dev/prod server.

**Inputs / dependencies:** T1–T7 merged.

**Parallelizable:** no (final integration).

**Isolation boundary:** `tests/smoke.mjs`.

**Steps:**
1. Extend the smoke flow: register → go to `/accounts` → create an account → add a card → go to dashboard → add a commitment linked to that card → assert the account/card text shows on the commitment card.
2. Delete the card → assert the commitment still exists (now unlinked, no card text). (PRD User Story 8.)
3. Delete the account → assert no error, its cards are gone, and the (already-unlinked) commitment is intact. (PRD User Story 9 — required, not optional: this is the only place cascade+unlink is proven end-to-end.)
4. Run full proving command + smoke.

**Acceptance criteria:**
- `npm run build` passes clean.
- `node tests/smoke.mjs` passes the extended flow including both the card-delete-survives (US8) and account-delete-cascade (US9) assertions.

**Verification:** `npm run build` then start a server and `node tests/smoke.mjs`; read full output + exit status.
