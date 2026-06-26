# Plan — Collapse to single-layer PaymentAccount + default account

**Source PRD:** `plans/payment-account-collapse.prd.md`
**Tier:** B · Data Class D4 · Blast Radius B1
**Execution pattern:** parallel-waves (sequential foundation → parallel API + pages → parallel UI → single verify)

## Execution contract

- **Task graph:** see diagram below.
- **Ownership boundaries:** each task names the exact files it touches; no two
  parallel tasks share an unstable file. Waved dependencies are absolute — a
  later wave cannot start until every task in the prior wave reports `done`.
- **Proving command (per wave + overall):** `npm run build`. Final wave also
  runs `node tests/smoke.mjs` against a running dev server (see T6).
- **Design system constraint:** every task in Wave 3 (UI) MUST load the three
  named skills (`ui-ux-pro-max`, `frontend-design`, `make-interfaces-feel-better`)
  before writing any JSX. The Earthy Soft tokens (`surface`, `tnum`, Fraunces,
  Inter, cobalt-ish `--primary`, `cubic-bezier(0.2,0,0,1)`) are the only
  permitted styling vocabulary. Page/subcomponent layout must reuse the existing
  `AppHeader` / `TabBar` shell.

```
Wave 1:  T1 (schema+migration)
            │
            ▼
         T2 (lib/* rewrite)
            │
            ├──────────────┐
Wave 2:  T3a T3b T3c T3d   T4a T4b T4c
            ├──────────────┘
            ▼
Wave 3:  T5a T5b T5c T5d T5e T5f
            ▼
Wave 4:  T6 (smoke + final verify)
```

---

## T1 — Prisma schema + bespoke migration

- **Title:** Collapse schema; write one atomic migration with data back-fill
- **Objective:** Drop `Card` model + `PaymentAccount.type` + `Card.network`; add
  `PaymentAccount.last4`; rename `Commitment.cardId` → `accountId` FK →
  `PaymentAccount` (`SetNull`); add nullable `User.defaultAccountId` FK →
  `PaymentAccount` (`SetNull`). Migrate existing rows atomically.
- **Context:**
  - Current schema is in `prisma/schema.prisma`. Existing migration
    `20260625030419_payment_accounts` is on disk and applied; prisma's
    migration history table has its row.
  - The bespoke migration must run successfully on a DB that has both bare
    `PaymentAccount` rows (last4-less) and `Card` rows under them. The
    migration is ONE-WAY — there is no down path.
  - Prisma's `migrate dev` generates the structural DDL but cannot write the
    data back-fill; you must hand-edit the generated `migration.sql` to add
    the back-fill `INSERT`s before committing.
- **Inputs / dependencies:** none (first task). Reads `prisma/schema.prisma`, the
  prior `20260625030419_payment_accounts/migration.sql`.
- **Parallelizable:** no (foundation).
- **Isolation boundary:** touches only `prisma/schema.prisma` and creates one
  new file under `prisma/migrations/<new_ts>_collapse_payment_accounts/migration.sql`.
- **Steps:**
  1. Edit `prisma/schema.prisma`:
     - `PaymentAccount`: drop `type`; add `last4 String?`. Keep `name`,
       timestamps, `cards Card[]` removed.
     - Delete the entire `model Card` block.
     - `Commitment`: rename `cardId` → `accountId`; rename `card Card?` →
       `account PaymentAccount?` with `@relation(fields: [accountId],
       references: [id], onDelete: SetNull)`.
     - `User`: add `defaultAccountId String?` and `defaultAccount
       PaymentAccount? @relation("DefaultAccount", fields:
       [defaultAccountId], references: [id], onDelete: SetNull)`. Add a
       matching back-relation `defaultFor User[] @relation("DefaultAccount")`
       on `PaymentAccount` so Prisma knows the link is named (avoids the
       implicit single-relation clash with `User.paymentAccounts`).
     - `PushSubscription`, `Credential`: unchanged.
  2. Run `npx prisma migrate dev --name collapse_payment_accounts --create-only`
     to scaffold the migration directory with structural DDL.
  3. Hand-edit the generated `migration.sql`. Wrap the whole thing in
     `PRAGMA defer_foreign_keys=ON;` … `PRAGMA foreign_keys=ON;`. Insert
     back-fill SQL between the new-table creation and the old-table drop:
     - Create `new_PaymentAccount (id, userId, name, last4, createdAt, updatedAt)`.
     - `INSERT INTO new_PaymentAccount (id, userId, name, last4, createdAt, updatedAt)
       SELECT id, userId, name, NULL, createdAt, updatedAt FROM PaymentAccount;`
       (bare old accounts; last4 N/A → null).
     - `INSERT OR IGNORE INTO new_PaymentAccount (id, userId, name, last4, createdAt, updatedAt)
       SELECT c.id, pa.userId, c.label, c.last4, c.createdAt, c.updatedAt
       FROM Card c JOIN PaymentAccount pa ON c.accountId = pa.id;`
       (`OR IGNORE` is defensive — other than the cuid disjoint-space
       guarantee there's no PK collision expected).
     - Create `new_Commitment` with `accountId` (was `cardId`).
     - `INSERT INTO new_Commitment (...) SELECT ..., cardId AS accountId, ...
       FROM Commitment;` (cardId now references a PaymentAccount row).
     - Drop old `Card`, old `PaymentAccount`, old `Commitment`; rename `new_*`
       to final names.
     - Add column `defaultAccountId` to `User` (TEXT, nullable, FK to
       `PaymentAccount` `SetNull`).
     - Recreate indexes: `PaymentAccount(userId)`, `Commitment(userId,
       isActive, nextDueDate)`, `Commitment(accountId)`.
     - **Idempotency note:** `prisma migrate deploy` runs every prior
       migration in order, so `Card` exists (empty) on a fresh DB — the
       `INSERT … SELECT FROM Card` returns 0 rows harmlessly. No `IF EXISTS`
       wrap (SQLite has no such conditional table-reference form).
  4. Run `npx prisma migrate deploy` locally:
     - once against a DB that has real Card rows (existing dev DB) — verify
       cards → accounts back-fill produces PaymentAccount rows with id = old
       Card id and commitment.accountId points at them.
     - once against a brand-new DB (`rm` the DB file, then `migrate deploy`) —
       verify the migration runs cleanly with 0 inserts.
  5. Run `npx prisma generate` to regen the client. `npx prisma studio` and
     visually verify: `PaymentAccount` has rows migrated from old cards; each
     old commitment's `accountId` points at one of them; bare old accounts
     exist with `last4 = null`. Commit the migration.
- **Acceptance criteria:**
  - `npx prisma migrate deploy` exits 0 against both a populated DB and a
    brand-new one.
  - `npx prisma generate` exits 0.
  - `prisma studio` shows the new shape; no `Card` table; `PaymentAccount.last4`
    column present; `Commitment.accountId` column present.
- **Verification:** `npx prisma migrate status` clean; commit message body
  contains the structural change; no `Card` references remain in the schema.

---

## T2 — Rewrite `src/lib/*` on the new schema

- **Title:** Update types, constants, validation, accounts, commitments, analytics
- **Objective:** Align every server-only lib module with the single-layer model
  and the new `User.defaultAccountId`. No UI, no routes touched.
- **Context:** `src/lib/types.ts` exposes `CommitmentDTO`, `CardDTO`,
  `PaymentAccountDTO`. `src/lib/validation.ts` has `accountInputSchema`,
  `cardInputSchema`, `cardUpdateSchema`, and `commitmentInputSchema.cardId`.
  `src/lib/constants.ts` exposes `ACCOUNT_TYPES`, `ACCOUNT_TYPE_LABELS`,
  `CARD_NETWORKS`, `CARD_NETWORK_LABELS`, `AccountType`, `CardNetwork`.
  `src/lib/accounts.ts` exports `AccountWithCards`, `getAccountsWithCards`,
  `getCardForUser`. `src/lib/commitments.ts` exports `CommitmentWithCard`,
  `getActiveCommitments`, `getCommitmentsDueForReminder`. `src/lib/analytics.ts`
  reads `c.card?.accountId` and `c.card?.accountName`.
- **Inputs / dependencies:** T1 done (new Prisma client available).
- **Parallelizable:** no (foundation; all interlocked).
- **Isolation boundary:** touches only files under `src/lib/`.
- **Steps:**
  1. `src/lib/constants.ts` — remove `ACCOUNT_TYPES`, `ACCOUNT_TYPE_LABELS`,
     `CARD_NETWORKS`, `CARD_NETWORK_LABELS`, `AccountType`, `CardNetwork`.
     Leave `COMMITMENT_*`, `CYCLE_*`, `CURRENCIES`, `RENEWAL_MODES`,
     `REMINDER_*` untouched. Add one exported const `PAYMENT_ACCOUNT_LABEL_MAX =
     60` and `PAYMENT_LAST4_LEN = 4` for symmetry with the existing `*_MAX`
     style? Only if a constant is actually referenced more than once; otherwise
     inline.
  2. `src/lib/types.ts` — drop `CardDTO`; collapse `PaymentAccountDTO` to
     `{ id, name, last4: string | null }`; drop `CommitmentDTO.card` /
     `CommitmentDTO.cardId`, add `accountId: string | null` and `account:
     { id, name, last4 } | null`.
  3. `src/lib/validation.ts`:
     - Remove `accountUpdateSchema`'s `type` field; remove `cardInputSchema`
       and `cardUpdateSchema`.
     - Replace `accountInputSchema` with `z.object({ name: z.string().trim()
       min(1).max(60), last4:
       z.union([z.string().regex(/^\d{4}$/, "Last 4 must be exactly 4 digits"),
       z.literal(""), z.null()]).optional() })`.
     - `accountUpdateSchema = accountInputSchema.partial()`.
     - `commitmentInputSchema.cardId` → `accountId: z.cuid().nullable().optional()`.
     - Do not add a `setDefaultSchema` — the body-less endpoints don't need one.
  4. `src/lib/accounts.ts`:
     - Drop `AccountWithCards`, `getAccountsWithCards`, `getCardForUser`.
     - `export type AccountRow = Prisma.PaymentAccountGetPayload<{}>` (or just
       `PaymentAccount` from `@prisma/client`).
     - `getAccounts(userId)` returns `prisma.paymentAccount.findMany({ where:
       { userId }, orderBy: { name: "asc" } })`.
     - `getAccountForUser(userId, id)` returns the row or null
       (`findFirst({ where: { id, userId } })`).
     - `getDefaultAccount(userId)` — single query that joins User →
       defaultAccount; returns `PaymentAccount | null`.
      - `setDefaultAccount(userId, id)` — `prisma.$transaction` (two updates):
        (1) `updateMany({ where: { id, userId }, data: {} })` to confirm
        ownership and reject cross-user ids (count=0 → throw a typed
        `AccountNotFoundError` — see 4a); (2) `prisma.user.update({ where:
        { id: userId }, data: { defaultAccountId: id } })` to write the new
        default. The at-most-one invariant falls out of writing a single
        `User.defaultAccountId` column — no separate "clear prior" step.
     - `clearDefaultAccount(userId)` — `prisma.user.update({ where: { id:
       userId }, data: { defaultAccountId: null } })`. No-op if already null.
  5. `src/lib/commitments.ts`:
     - `CommitmentWithCard` → `CommitmentWithAccount = Prisma.CommitmentGetPayload<{
       include: { account: true } }>`.
     - `getActiveCommitments` now `include: { account: true }`.
     - `getCommitmentsDueForReminder` currently includes only `{ user: true }`
       and the reminder route accesses no account fields — leave the include
       shape unchanged. Do NOT add account here.
  6. `src/lib/analytics.ts`:
     - Replace `c.card?.accountId ?? UNASSIGNED_ACCOUNT_ID` with `c.account?.id
       ?? UNASSIGNED_ACCOUNT_ID`.
     - Replace `c.card?.accountName ?? UNASSIGNED_ACCOUNT_NAME` with
       `c.account?.name ?? UNASSIGNED_ACCOUNT_NAME`.
     - The `AccountTotal.accountId` / `accountName` field names stay (callers
       use them).
  7. Run `npm run build`. Fix any TS errors that surface (other modules
     importing the old shapes will show up — but no UI yet, see T3-T6).
- **Acceptance criteria:**
  - `npm run build` succeeds with no TS errors coming from `src/lib/*`.
  - No remaining imports of `AccountType`, `CardNetwork`, `CardDTO`,
    `getCardForUser`, or `getAccountsWithCards` anywhere in the repo.
- **Verification:** `npm run build`; `rg "AccountType|CardNetwork|getCardForUser|
  cardInputSchema|getAccountsWithCards" src` returns nothing.

---

## T3 — API routes (parallel batch)

All tasks in T3 depend on T2. Each touches disjoint files under `src/app/api/`
so they parallelize safely.

### T3a — `/api/accounts` + `/api/accounts/[id]` rewrites

- **Title:** Simplify account root routes; drop `type`; augment GET response
- **Objective:** Update POST/PATCH bodies to `{ name, last4 }`; DELETE clears
  default if the deleted row is the default (via schema `SetNull` — no extra
  code needed; verify). **GET response must include `defaultAccountId`** so
  the client dialog (T5d) can prefill on create.
- **Context:** Existing routes import `accountInputSchema`, `accountUpdateSchema`,
  `getAccountsWithCards`. Replace imports. DELETE path uses `deleteMany` scoped
  by `userId`; cascades were at the schema layer (User.defaultAccountId
  SetNulls on account delete).
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes (within T3 batch).
- **Isolation boundary:** `src/app/api/accounts/route.ts`,
  `src/app/api/accounts/[id]/route.ts` only.
- **Steps:**
  1. `route.ts` (root): swap imports to `getAccounts`,
     `getDefaultAccount`, `accountInputSchema`. GET returns
     `{ accounts, defaultAccountId: defaultAccount?.id ?? null }` (a single
     extra round-trip — keep simple). POST persists `{ userId, name, last4:
     input.last4 || null }`; preserve P2003 → 401 catch.
  2. `[id]/route.ts` PATCH: build data only from provided fields; `last4` empty
     string → null (mirror card route's cleared-field sentinel). DELETE
     unchanged (already scoped + cascades).
- **Acceptance criteria:** Build clean; smoke step 1/2 exercise POST; smoke
  step 3/6 exercise GET response carrying `defaultAccountId`.
- **Verification:** `npm run build`; manual curl smoke if needed.

### T3b — New `/api/accounts/[id]/default` route

- **Title:** Set + clear default account endpoints
- **Objective:** `POST` makes the row the user's default (auth + ownership
  checked); `DELETE` clears the default. At-most-one invariant comes from the
  single `User.defaultAccountId` column.
- **Context:** New file. Reuses `setDefaultAccount` / `clearDefaultAccount` /
  `getAccountForUser` from T2's `src/lib/accounts.ts`. Map
  `AccountNotFoundError` → 404.
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/app/api/accounts/[id]/default/route.ts` only (new file).
- **Steps:**
  1. POST: `auth()`; parse `{ }` (body-less, but tolerate empty json); call
     `setDefaultAccount(session.user.id, id)`; try/catch; map `P2003` → 401.
  2. DELETE: `auth()`; call `clearDefaultAccount(userId)`; map P2003 → 401.
  3. Both return `{ ok: true }` on success and the appropriate 401/404 on
     failure.
- **Acceptance criteria:** smoke step 2 (set A → set B → assert A loses badge)
  exercises POST; smoke step 6 (unset affordance) exercises DELETE.
- **Verification:** `npm run build`.

### T3c — Delete nested card routes

- **Title:** Remove card route subtree
- **Objective:** Drop `src/app/api/accounts/[id]/cards/` entirely.
- **Context:** No callers will remain after T5 finishes (commitment-dialog + UI
  removed). Safe to delete now since the build only fails if some non-deleted
  file imports them — verify with `rg` at the end of T3c.
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes (deletion only).
- **Isolation boundary:** deletes `src/app/api/accounts/[id]/cards/**`.
- **Steps:**
  1. `rm -r "src/app/api/accounts/[id]/cards"`.
  2. `rg "accounts/.*/cards" src` — confirm no remaining import URLs in any
     non-deleted TS file before declaring done. (Ignore `tests/smoke.mjs` — T6
     rewrites it.)
- **Acceptance criteria:** build clean despite deletions; no remaining
  `accounts/[id]/cards` references outside `tests/smoke.mjs`.
- **Verification:** `rg "accounts/.*/cards" src` clean.

### T3d — `/api/commitments` routes: `cardId` → `accountId`

- **Title:** Swap link FK name in commitment routes
- **Objective:** POST + PATCH validate `accountId` ownership via
  `getAccountForUser`. Keep P2003 → 401 path.
- **Context:** Existing POST and PATCH reference `cardId` and `getCardForUser`.
  Both files import from `src/lib/accounts.ts` (already rewritten in T2).
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes (within T3 batch).
- **Isolation boundary:** `src/app/api/commitments/route.ts`,
  `src/app/api/commitments/[id]/route.ts`.
- **Steps:**
  1. POST: swap `cardId` → `accountId` field per validation schema (already
     renamed in T2). Swap `getCardForUser` → `getAccountForUser`. Replace the
     "Unknown card" error string with "Unknown account". Replace
     `data.cardId: input.cardId ?? null` with `data.accountId: input.accountId
     ?? null`.
  2. PATCH: same renames in both the guard and the build-data section. Keep
     the `data.accountId` scalar-set-null path.
  3. DELETE: unchanged.
- **Acceptance criteria:** smoke step 3 (create linked commitment) + step 5
  (edit no-op) + step 7 (delete account → commitment SetNull) succeed.
- **Verification:** `npm run build`; then smoke.

---

## T4 — Server pages (parallel batch)

Both depend on T2 (lib shapes) and run in parallel with T3 (disjoint files).

### T4a — `src/app/page.tsx` DTO mapping

- **Title:** Map commitment rows with `account` include to new DTO
- **Objective:** Replace `c.card.*` mapping with `c.account.*`. Drop
  `CardNetwork` import.
- **Context:** The current `HomePage` builds `card` from `c.card?.id`,
  `.label`, `.last4`, `.network`, `.accountId`, `.accountName`. New shape: if
  `c.account` exists, build `account` summary `{ id, name, last4 }`.
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/app/page.tsx` only.
- **Steps:** map each new field; remove the now-unused `CardNetwork` import.
- **Acceptance criteria:** build clean; dashboard renders.
- **Verification:** `npm run build`.

### T4b — `src/app/analytics/page.tsx` DTO mapping

- **Title:** Same field rename mapping for analytics
- **Objective:** Replace `c.card?.*` in the `computeAnalytics` argument with
  `c.account?.*`; drop `CardNetwork` import.
- **Context:** `stats.byAccount` is keyed by `accountId`/`accountName` — leave
  the analytics component prop-types untouched.
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/app/analytics/page.tsx`.
- **Steps:** 1-to-1 rename in the mapping block.
- **Acceptance criteria:** build clean.
- **Verification:** `npm run build`.

### T4c — `src/app/accounts/page.tsx` (new flat shape + default id)

- **Title:** Pass flat `PaymentAccountDTO[]` and the user's `defaultAccountId`
- **Objective:** Drop the `cards` lens; pass the user's `defaultAccountId` (as
  nullable string) so AccountsManager can mark badge state.
- **Context:** Currently maps `accounts.cards`. New lib: `getAccounts` returns
  bare `PaymentAccount`. Need to also fetch the user's `defaultAccountId`. Two
  options: add a `getDefaultAccount(userId)` call (already in T2) and pass the
  id — OR include the user's row via `prisma.user.findUnique`. Cheapest: call
  `getDefaultAccount(userId)` (one query) and pass `.id` (or null).
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/app/accounts/page.tsx`.
- **Steps:**
  1. Replace import `getAccountsWithCards` with `getAccounts` +
     `getDefaultAccount`.
  2. Map DTOs to `{ id, name, last4 }`.
  3. Pass `defaultAccountId` prop to `<AccountsManager>`.
  4. Rename `subtitle` text in `AppHeader` (currently says "X accounts · Y
     cards"; change to "X accounts" since there are no cards).
  5. Title — change `title="Cards"` to `title="Accounts"`.
- **Acceptance criteria:** build clean; `/accounts` loads with flat list;
  default badge shows.
- **Verification:** `npm run build`.

---

## T5 — UI redesign (parallel batch, three design skills MANDATORY)

Every task in T5 must, before writing JSX, call `skill("ui-ux-pro-max")`,
`skill("frontend-design")`, and `skill("make-interfaces-feel-better")`. Pick
styles/tokens consistent with the existing dashboard / commitment-card /
account-dialog patterns (Earthy Soft). PWA / push / proxy untouched.

All T5 tasks depend on T2 + T4. They parallelize because each touches a
disjoint client component file. T5a–T5e are the core redesign (accounts manager,
account dialog, commitment-card meta, commitment-dialog picker, dashboard
filter). T5f combines the read-only analytics-component audit with a simple
`card-dialog.tsx` deletion — its `rm` step depends on T5a having removed the
last import of `CardDialog`, so within Wave 3 T5f should sign off last.

### T5a — `src/components/accounts/accounts-manager.tsx` flat list redesign

- **Title:** Redesign accounts list as single-layer with default badge + actions
- **Objective:** Flat rows, each showing name + optional last4 chip + default
  badge (if current default) + actions: set-default, unset-default (only shown
  on the default row), edit, delete. Empty state retained. Add-account button.
  Animate rows with the existing `animate-reveal` stagger.
- **Context:** Current component handles account expand/collapse plus cards. No
  more expand/collapse. Receive `initialAccounts: PaymentAccountDTO[]` and
  `defaultAccountId: string | null`. State: `dialog` discriminated union
  (add-account / edit-account / delete-account / set-default / unset-default —
  set/unset-default need no dialog, they're optimistic calls).
- **Inputs / dependencies:** T2 + T4c.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/components/accounts/accounts-manager.tsx`.
- **Steps:**
  1. Load three design skills.
  2. Construct flat row layout using `surface`, ≥44px tap targets, lucide
     icons (`Landmark` removed — type is gone; pick one generic — `CreditCard`
     or `Wallet` — and use for every row).
  3. Each row: leading icon chip · name · optional last4 chip (`·` prefix,
     `tnum`) · default badge ("Default" filled pill, primary tint) when the
     row's id === defaultAccountId · actions: set-default (only when not the
     default), unset-default (only when it is the default), edit (Pencil),
     delete (Trash2).
  4. Set/unset-default call the new `/api/accounts/[id]/default` endpoints
     (POST and DELETE). On 200, `router.refresh()` (server re-fetches
     `defaultAccountId`). On 401, signOut.
  5. Empty state ("No accounts yet") — same copy but update the body
     ("Add a bank, card, e-wallet, or cash…" no longer mentions types since we
     dropped type; rewrite to "Add something you pay from — a bank, a card, an
     e-wallet, or cash." Actually any framing is fine — match Earthy Soft vibe).
  6. Delete the `CardDialog`, `CardDTO`, `CARD_NETWORK_LABELS` imports.
  7. Use the same `Dialog` / `AccountDialog` flow for add/edit, the existing
     `ConfirmDeleteDialog` for delete confirm.
- **Acceptance criteria:**
  - Flat rows render; default badge matches server state.
  - Set/unset actions fire correct endpoints and refresh the page.
  - Smoke steps 1, 2, 6, 7 (badge assertions + unset affordance) pass.
- **Verification:** `npm run build`; then smoke.

### T5b — `src/components/accounts/account-dialog.tsx` simplified

- **Title:** Two-field dialog: name + optional last4
- **Objective:** Replace name + type select with name + last4 input (numeric,
  4-digit, optional). Same dialog shell, same `h-12 flex-[1.4] rounded-lg…`
  button styling, Fraunces title.
- **Context:** Re-use existing `Dialog` / `Input` / `Label` primitives. POST /
  PATCH bodies match new `accountInputSchema`.
- **Inputs / dependencies:** T2.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/components/accounts/account-dialog.tsx`.
- **Steps:**
  1. Load three design skills (briefly — this is mostly an existing-template
     strip-down to reuse CardDialog's last4 input pattern).
  2. Remove `type` Select + `ACCOUNT_TYPES` import. Add `last4` input mirroring
     CardDialog's pattern: numeric-only, `maxLength={4}`, `tnum`, "opt." label.
  3. POST/PATCH body: `{ name, last4: last4.trim() === "" ? null : last4 }`.
  4. Submit disabled when `name.trim().length === 0` (last4 always optional).
- **Acceptance criteria:** smoke step 1 ("Add account" → fill name + last4 →
  assert with last4 chip) and step 2 (no-last4 account renders without chip)
  succeed via this dialog.
- **Verification:** `npm run build`.

### T5c — `commitment-card.tsx` meta row

- **Title:** Show `account.name · last4` (or just name) in the expanded detail
- **Objective:** Drop the `CreditCard` meta line's card-account nesting; use
  `commitment.account` directly.
- **Context:** Existing block reads `commitment.card?.accountName`,
  `commitment.card?.last4`, `commitment.card?.label`. New DTO has
  `commitment.account`.
- **Inputs / dependencies:** T2 + T4a.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/components/commitment-card.tsx` only (the expanded
  detail `<div>` containing the CreditCard block, ~30 lines).
- **Steps:**
  1. Replace `{commitment.card && (…)}` with `{commitment.account && (…)}`.
  2. Render `{commitment.account.name}{commitment.account.last4 ? ` ·
     ${commitment.account.last4}` : ""}` — drop the `label` fallback entirely
     since `label` no longer exists; account.name is now the only label.
  3. Keep the `CreditCard` leading glyph (or swap to `Wallet` if the design
     skill prefers — pick a single look across cards + accounts).
- **Acceptance criteria:** expanded commitment shows correct meta; smoke
  step 4 (`A name ·4242` visible in expanded card) passes.
- **Verification:** `npm run build`.

### T5d — `commitment-dialog.tsx` single account picker + default prefill + in-dialog Add account

- **Title:** Replace account→card two-step picker with single account picker
  prefilled from the default on create; never prefill on edit; add inline
  "Add account" affordance when account list is empty
- **Objective:**
  - Create dialog: account picker initial value = `defaultAccountId ?? NO_ACCOUNT`.
  - Edit dialog: account picker initial value = `commitment.accountId`.
  - Single `Select` (no card sub-select). Posts `accountId: value === NO_ACCOUNT
    ? null : value`.
  - When `accounts.length === 0`, render an inline "Add account" button in place
    of the picker that opens the existing `AccountDialog` (path
    `src/components/accounts/account-dialog.tsx`) in-place; after save,
    refetch the accounts list and re-render.
- **Context:** GET response now includes `defaultAccountId` (per T3a step 1).
  The Add-account affordance depends on the *existing* `AccountDialog` file
  path — its interface contract is unchanged by T5b (both still accept
  `account?: PaymentAccountDTO; onClose; onSaved`). T5b's cosmetic redesign
  of internals does not block T5d's wiring.
- **Inputs / dependencies:** T2 + T3a (for the augmented GET response). T5b's
  cosmetic edits land in parallel; only contract needs to hold.
- **Parallelizable:** yes — within Wave 3.
- **Isolation boundary:** `src/components/commitment-dialog.tsx` only.
- **Steps:**
  1. Load three design skills.
  2. Fetch `accounts + defaultAccountId` from `/api/accounts` (response shape
     `{ accounts, defaultAccountId }`).
  3. On **create** (no `commitment` prop): Initialise `accountId` state to
     `defaultAccountId ?? NO_ACCOUNT`. (Read once; no reactive re-prefill.)
  4. On **edit** (`commitment` prop present): Initialise `accountId` to
     `commitment.accountId ?? NO_ACCOUNT`. NEVER read default in edit mode.
  5. Replace both account and card Selects with ONE account Select: options are
     each account name, plus a leading "No account" option (`NO_ACCOUNT`
     sentinel). Optional Add-account affordance goes inside SelectContent's
     footer or as a separate inline element when `accounts.length === 0`.
  6. Form body posts `{ …, accountId: accountId === NO_ACCOUNT ? null : accountId }`.
  7. Add-account affordance: when `accounts.length === 0`, render a button "Add
     account" that opens `<AccountDialog onSaved={refreshAccounts} />`; on
     saved, refetch /api/accounts and select the newly created account if it
     was the first one.
  8. Drop `PickerCard`, `cardsForAccount`, `cardId`, `setCardId`, `NO_CARD`,
     `NO_CARD` sentinel, `cardOptionLabel` helper.
  9. Remove the network chip rendering, label fallback — they don't apply.
- **Acceptance criteria:**
  - Smoke step 3: create dialog prefilled with B (default) → picker opens
    showing B selected.
  - Smoke step 5: edit dialog starts on A (not default B); after a no-change
    save the dashboard's expanded commitment card still shows A's meta (no
    silent flip — verified via the rendered card meta, NOT via PATCH response
    which returns `{ ok: true }`).
  - Smoke step 6: after unset-default, create dialog starts on "No account"
    (no accounts were deleted, B alive).
- **Verification:** `npm run build`; smoke.

### T5e — `dashboard.tsx` account filter

- **Title:** Update filter facet to key by `c.account?.id`
- **Objective:** Account multi-select continues to work on the flat shape; no
  nested account-in-card; "Unassigned" bucket stays.
- **Context:** Currently builds `accounts` map from `c.card?.accountId` +
  `c.card?.accountName`. Filter predicate uses `c.card?.accountId ?? ACCOUNT_UNASSIGNED`.
- **Inputs / dependencies:** T2 + T4a.
- **Parallelizable:** yes.
- **Isolation boundary:** `src/components/dashboard.tsx` only.
- **Steps:**
  1. In the `accounts` useMemo, read `c.account?.id` and `c.account?.name`.
  2. In the predicate, use `c.account?.id ?? ACCOUNT_UNASSIGNED`.
  3. No other shape change.
- **Acceptance criteria:** existing filter surface continues to render
  (smoke step 6's assertion that opening the filter does not crash,
  adapted by T6).
- **Verification:** `npm run build`.

### T5f — Analytics sub-components sanity audit + delete `card-dialog.tsx`

- **Title:** Confirm `account-share-donut.tsx` + `type-bar-chart.tsx` need no churn; trash the now-unused `card-dialog.tsx`
- **Objective:** `stats.byAccount` retains same field names (`accountId`,
  `accountName`, `byCurrency`, `count`); donut should work as-is. Also delete
  the now-unused `src/components/accounts/card-dialog.tsx` (the only import
  was in `accounts-manager.tsx`, which T5a removed).
- **Context:** T5a removed the `CardDialog` import + state. The physical file
  is dead source — T5a is allowed to delete it itself, but for clarity this
  tidy-up lands in T5f so T5a can focus on the manager rewrite. Reads in this
  audit are read-only. `card-dialog.tsx` deletion is a filesystem action.
- **Inputs / dependencies:** T2 + T5a completed (no remaining imports of
  CardDialog after T5a's edit).
- **Parallelizable:** **conditional** — the read-only audit parallelizes with
  other Wave 3 tasks, but the `rm card-dialog.tsx` step must run after T5a
  signs off (once T5a removes the last import). If running T5 tasks in strict
  parallel, treat T5f's rm as a final mini-step once T5a reports done.
- **Isolation boundary:** `src/components/analytics/*` (read-only) +
  `src/components/accounts/card-dialog.tsx` (deleted).
- **Steps:**
  1. `rg "accountId|accountName|cardId|card\\.label|network" src/components/analytics`;
     no-fix-if-clean.
  2. `rg "card-dialog" src` — confirm no remaining imports.
  3. `rm src/components/accounts/card-dialog.tsx`.
- **Acceptance criteria:** `npm run build` clean; `/analytics` loads; no
  `card-dialog` references in `src/`.
- **Verification:** `npm run build`; `rg "card-dialog" src` clean.

---

## T6 — Smoke rewrite + final verify

- **Title:** Rewrite `tests/smoke.mjs` to match the new flow; run build + smoke
- **Objective:** Exercise every US from the PRD's Testing Decisions (steps 1-8).
  Proving command: `npm run build` + `node tests/smoke.mjs` against a running
  dev server.
- **Context:**
  - Existing smoke runs two-layer flow that no longer works.
  - Run a dev server first (`npm run dev`), then `node tests/smoke.mjs`. The
    harness uses `BASE = process.env.BASE ?? "http://localhost:3944"` — match
    the dev port.
  - Replace all `card-label` / `card-last4` selectors with new dialog selectors
    (`account-name` / `account-last4` — must match what T5b set as ids).
- **Inputs / dependencies:** all prior tasks done.
- **Parallelizable:** no (final wave).
- **Isolation boundary:** `tests/smoke.mjs` (only edit). May also run dev server
  side-effects but no source edits.
- **Steps:**
  1. Rewrite `tests/smoke.mjs` per the 8 numbered smoke steps in the PRD
     `Testing Decisions` section.
  2. Bump the smoke harness's selectors to match the new dialog ids (`#account-
     name`, `#account-last4`) — coordinate with T5b defensively by adding ids
     if missing.
  3. **Smoke step 5 mechanism:** The PATCH `/api/commitments/[id]` route
     returns `{ ok: true }` (no `accountId` in the response) — do NOT assert
     against the response body. After the no-change save, `router.refresh()`
     re-renders the dashboard; assert by re-expanding the commitment card and
     reading its meta text (`A name ·4242`), proving the link survived
     intact without flipping to the default.
  4. Run `npm run build`.
  5. Start dev server backgrounded (`npm run dev &` or use the repo's existing
     pattern from `tests/README.md` if there is one).
  6. Run `node tests/smoke.mjs`. All assertions pass.
  7. Stop dev server.
- **Acceptance criteria:**
  - `npm run build` exits 0.
  - `node tests/smoke.mjs` prints `✓ ALL CHECKS PASSED — no console/page errors`.
- **Verification:** paste the final output of both commands.

---

## Wave gates

- Wave 1 (T1): gate on `npx prisma migrate status` clean + `npx prisma generate`.
- Wave 1 (T2): gate on `npm run build` clean + `rg` no-stale-imports check.
- Wave 2 (T3a T3b T3c T3d, T4a T4b T4c): gate on `npm run build` clean and no
  cross-task file conflicts (verify by `git status` showing each task's claimed
  files only).
- Wave 3 (T5a T5b T5c T5d T5e T5f): gate on `npm run build` clean; verify
  each design skill was loaded (T5 implementer mentions it in their final
  message — non-blocking on the others).
- Wave 4 (T6): gate on smoke printing `ALL CHECKS PASSED`.

The plan ends here. `code-review` follows T6 inside the same autopilot run
(via `verify` then fresh `review` subagent on the full diff).