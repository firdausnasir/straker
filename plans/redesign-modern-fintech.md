# Implementation Plan — Modern-Fintech Redesign (visual-only)

> PRD: `plans/redesign-modern-fintech.prd.md` (read it first — it is the shared
> design-system contract every task obeys). Tier B · D4 · B1 · AI Mode generate.

## Execution contract

**Pattern:** parallel-waves. Token layer is a sequential blocking foundation;
shared primitives/chrome run as a small parallel wave; the five surfaces run as
a fully parallel wave on disjoint files.

**Task graph / dependencies:**

```
Wave 0 (sequential, blocking)
  T1  Token layer + fonts           ── blocks everything
Wave 1 (parallel, after T1)
  T2  Shared ui/ primitives         ┐ disjoint files, run together
  T3  Nav chrome (tab-bar/header)   ┘
Wave 2 (parallel, after T1+T2+T3)
  T4 Dashboard │ T5 Analytics │ T6 Settings │ T7 Login │ T8 Accounts
     (each owns a disjoint file set — safe concurrent)
Wave 3 (sequential, after Wave 2)
  T9  Full-app verification + visual QA
```

**Ownership boundaries (no two active tasks touch the same file):**
- T1 owns `globals.css`, `layout.tsx`.
- T2 owns `src/components/ui/*` (button + the dialog/alert/select/input/dropdown/
  segmented primitives actually used). T2 does NOT touch `running-total`,
  `date-picker`, or `theme-button` (those belong to surface tasks).
- T3 owns `tab-bar.tsx`, `app-header.tsx`. Surface tasks render these but never edit them.
- T4 owns `dashboard.tsx`, `commitment-card.tsx`, `commitment-dialog.tsx`, `date-picker.tsx`.
- T5 owns `analytics/page.tsx`, `running-total.tsx`, new `components/analytics/*`.
- T6 owns `settings/page.tsx`, `settings-client.tsx`, `passkey-settings.tsx`,
  `pwa/notifications-settings.tsx`, `theme-button.tsx`.
- T7 owns `login/page.tsx`, `login/auth-form.tsx`.
- T8 owns `accounts/page.tsx`, `components/accounts/*`.

**Proving command:** `npm run build` (Turbopack prod build = lint + typecheck +
compile) per task. Final gate T9 adds `node tests/smoke.mjs` (server running) +
manual light/dark QA. **No logic/API/auth/prisma/cron edits in any task.**

---

## T1 — Token layer + fonts (foundation)

- **Title:** Rewrite the design-token layer and load the new fonts.
- **Objective:** Re-point every CSS var, semantic token, utility class, elevation,
  and motion value in `globals.css` to the locked modern-fintech system, and swap
  the `next/font` faces in `layout.tsx`, so the new look propagates through all
  token-consuming components.
- **Context:** Current `globals.css` defines `:root`/`.dark` Statement palette
  (wine/paper), `@theme inline` mapping to shadcn tokens, utility classes
  (`.surface`, `.stmt-row`, `.field`, `.font-display`, `.tnum`), and keyframes.
  `layout.tsx` loads Schibsted + Hanken Grotesk into `--font-display-face` /
  `--font-body` and sets `viewport.themeColor`. See PRD "Locked design system".
- **Inputs / dependencies:** PRD token table, type, elevation, gradient specs.
  None upstream — this is the root.
- **Parallelizable:** no (blocks all other tasks).
- **Isolation boundary:** `src/app/globals.css`, `src/app/layout.tsx` only.
- **Steps:**
  1. Replace `:root` + `.dark` palette vars with the PRD light/dark hexes
     (background, card, surface-2, foreground, muted-foreground, border, primary
     + primary-foreground, positive, warn, destructive, ring). Keep the same var
     *names* the components consume; retire wine/oxblood-specific names by
     aliasing or removing only after grep confirms no consumer.
  2. Add the elevation scale (`--elev-1`, `--elev-2`, `--elev-overlay`) per theme.
     Update `--shadow-card`/`--shadow-overlay` to the new values.
  3. Set `--radius` to 12px base (controls derive 8–10px); update radius derivations.
  4. Rework utility classes: `.surface` → filled card (bg-card + `--elev-1` +
     12px radius), `.surface-overlay` → `--elev-overlay` + scrim. Keep `.field`,
     `.tnum`, `.font-display` (re-point `--font-display`), `.text-balance/pretty`.
     Retune keyframe easing; keep `prefers-reduced-motion` block. Add a cobalt→cyan
     gradient token for hero/CTA use.
  5. In `layout.tsx`: replace the two Google fonts with **IBM Plex Sans**
     (`--font-body`) and **IBM Plex Mono** (`--font-display-face` or a new
     `--font-mono-face` for hero numerals — pick one and document it); keep
     `display:swap` and the `<html>` variable wiring. Update `viewport.themeColor`
     light/dark to the new bg hexes. Do not touch the no-flash theme script or
     `.dark` toggle logic.
- **Acceptance criteria:** `npm run build` passes. App renders with new palette +
  fonts in light and dark with zero component edits. No semantic token name a
  consumer relies on is removed without migration. Theme toggle + no-flash intact.
- **Verification:** `npm run build`; load `/` in light and dark, confirm new
  colors/fonts and no console errors; toggle theme in Settings — no flash.

---

## T2 — Shared `ui/` primitives

- **Title:** Restyle the shared shadcn/base-ui primitives to the new system.
- **Objective:** Update the cross-cutting `ui/` primitives (button + dialog,
  alert-dialog, select, input, dropdown-menu, segmented control, sonner toast)
  so every surface inherits consistent filled/elevated chrome, radii, focus rings,
  and press feedback.
- **Context:** `ui/button.tsx` is a cva variant set on base-ui Button consumed
  everywhere; dialogs/inputs use `.surface-overlay`/`.field` + tokens. New radius
  is 8–10px controls, scale-0.96 press, 3px focus ring on `--ring`.
- **Inputs / dependencies:** T1 (tokens, radius, elevation, ring).
- **Parallelizable:** yes (with T3).
- **Isolation boundary:** `src/components/ui/*` only. Must NOT edit
  `running-total.tsx`, `date-picker.tsx`, `theme-button.tsx`.
- **Steps:**
  1. Update `buttonVariants` (default/outline/secondary/ghost/destructive/link,
     all sizes) to new tokens + radius + press scale; keep variant names + sizes.
  2. Restyle dialog/alert-dialog/popover content to `--elev-overlay` + 40–60% scrim.
  3. Restyle select/input/dropdown to the new `.field` look + focus ring; verify
     the SelectValue render-prop fix (label not id) still renders.
  4. Keep all primitive APIs/props unchanged — visual only.
- **Acceptance criteria:** `npm run build` passes. Buttons/dialogs/selects/inputs
  render the new style in both themes; ≥44px tap floors held; focus rings visible.
- **Verification:** `npm run build`; open the add-commitment dialog and a select
  to eyeball primitives in light + dark.

---

## T3 — Navigation chrome

- **Title:** Restyle the tab bar and app header.
- **Objective:** Bring the mobile bottom dock + desktop left rail and the page
  header into the new system (filled/elevated nav, cobalt active markers, new type).
- **Context:** `tab-bar.tsx` is one responsive element (bottom bar <md, left rail
  md+), active = wine markers today → cobalt; `app-header.tsx` is the shared
  display-title header used by analytics/settings/accounts. `--rail-w` offset and
  `useLinkStatus` spinner behavior must be preserved.
- **Inputs / dependencies:** T1 (tokens), T2 (if header uses Button).
- **Parallelizable:** yes (with T2).
- **Isolation boundary:** `tab-bar.tsx`, `app-header.tsx` only.
- **Steps:**
  1. Re-skin tab-bar surfaces/markers to cobalt + new elevation; keep responsive
     structure, `data-rail` collapse, safe-area padding, `useLinkStatus` spinner.
  2. Re-skin app-header to IBM Plex Sans display weight + muted subtitle.
  3. No route/behavior changes.
- **Acceptance criteria:** `npm run build` passes; nav renders new style mobile +
  desktop, active state clear, rail collapse + offset unchanged, ≥44px taps.
- **Verification:** `npm run build`; check `/` (mobile width) and a desktop width
  for dock vs rail, active highlight, collapse toggle.

---

## T4 — Dashboard surface

- **Title:** Restyle the Subscriptions dashboard, commitment card, dialog, date picker.
- **Objective:** Turn the ruled ledger list into modern filled commitment cards
  (leading type icon chip, name, hero amount, status pill), re-theme the add/edit
  dialog + date picker, and the sort/filter/empty states.
- **Context:** `dashboard.tsx` (header, sort dropdown, account FilterPills, ruled
  `.surface`+`.stmt-row` list, empty states); `commitment-card.tsx` (expandable
  row, urgency pill, action buttons); `commitment-dialog.tsx`; `date-picker.tsx`.
  All behavior (sort, filter, expand, renew/paid/edit/delete fetches) stays.
- **Inputs / dependencies:** T1, T2 (Button/dialog/select), T3 (renders TabBar).
- **Parallelizable:** yes (Wave 2; disjoint files).
- **Isolation boundary:** `dashboard.tsx`, `commitment-card.tsx`,
  `commitment-dialog.tsx`, `date-picker.tsx`.
- **Steps:**
  1. Convert the ledger list into per-item elevated cards (or a card with strong
     separation) + leading lucide category chip; keep sort/filter logic untouched.
  2. Restyle urgency pills to new warn/destructive/positive tokens; keep
     overdue/soon/paid semantics + `.tnum` on amounts.
  3. Hero amount uses the mono numeral treatment per PRD.
  4. Re-theme the two empty states and FilterPills (≥44px).
  5. Re-theme commitment-dialog + date-picker visually only.
- **Acceptance criteria:** `npm run build` passes; cards render new style both
  themes; sort/filter/expand/add/edit/delete behavior unchanged; amounts tabular,
  no reflow; urgency colors correct; ≥44px taps.
- **Verification:** `npm run build`; add → sort → filter → expand → edit a
  commitment in light + dark.

---

## T5 — Analytics surface + charts

- **Title:** Restyle analytics and add hand-built accessible charts.
- **Objective:** Render monthly outlook as bold balance stat cards (mono numeral),
  add a by-type horizontal bar chart and a per-account share donut (SVG/CSS, no
  library), re-theme by-type/by-account sections and empty state.
- **Context:** `analytics/page.tsx` consumes `computeAnalytics` output
  (`byCurrency`, `byType`, `byAccount`) and `RunningTotal`. No time-series data
  exists. Charts are presentation-only over already-computed numbers — do NOT
  edit `src/lib/analytics.ts`.
- **Inputs / dependencies:** T1, T3 (TabBar/AppHeader). PRD chart spec.
- **Parallelizable:** yes (Wave 2; disjoint files).
- **Isolation boundary:** `analytics/page.tsx`, `running-total.tsx`, new
  `src/components/analytics/*` (e.g. `type-bar-chart.tsx`,
  `account-share-donut.tsx`).
- **Steps:**
  1. Restyle monthly-outlook rows into hero stat cards; keep per-currency
     segregation (no FX) + `RunningTotal` digit-roll; re-skin RunningTotal numerals.
  2. Build `TypeBarChart` — horizontal bars, sorted desc, value labels, tokenized
     colors, ≥3:1 data / ≥4.5:1 label contrast, color-not-only, reduced-motion safe.
  3. Build `AccountShareDonut` — share of monthly spend within a currency, legend
     + value labels, ≤5 slices else bar fallback; numeric rows remain as the
     table-equivalent for a11y.
  4. Re-theme empty state.
- **Acceptance criteria:** `npm run build` passes; charts render in both themes,
  accessible (labels, contrast, reduced-motion), no `analytics.ts` edits; totals
  tabular; matches existing numbers exactly.
- **Verification:** `npm run build`; view `/analytics` with multi-currency data
  in light + dark + reduced-motion; confirm chart values equal the numeric rows.

---

## T6 — Settings surface

- **Title:** Restyle Settings, passkeys, notifications, theme control.
- **Objective:** Bring settings sections, the segmented theme control, passkey
  management, and notification settings into the new card system.
- **Context:** `settings/page.tsx`, `settings-client.tsx`, `passkey-settings.tsx`,
  `pwa/notifications-settings.tsx`, `theme-button.tsx`. All flows (theme set,
  passkey add/renew/rename/delete with password re-prove, push subscribe) stay.
- **Inputs / dependencies:** T1, T2, T3.
- **Parallelizable:** yes (Wave 2; disjoint files).
- **Isolation boundary:** the five files above only.
- **Steps:**
  1. Restyle section heads + cards to new system; re-skin the segmented control.
  2. Re-theme passkey + notification rows/buttons; keep all handlers + copy.
  3. theme-button visual update; theme logic untouched.
- **Acceptance criteria:** `npm run build` passes; settings render new style both
  themes; theme toggle, passkey, and notification flows behave unchanged; ≥44px taps.
- **Verification:** `npm run build`; toggle theme, open passkey + notification
  sections in light + dark.

---

## T7 — Login surface

- **Title:** Restyle the login page and auth form.
- **Objective:** Apply the new brand surface, palette, type, primary CTA, mode
  toggle, error state, and passkey button to the unauthenticated entry.
- **Context:** `login/page.tsx`, `login/auth-form.tsx` (login/register modes,
  passkey sign-in button, error display). Auth logic untouched.
- **Inputs / dependencies:** T1, T2.
- **Parallelizable:** yes (Wave 2; disjoint files).
- **Isolation boundary:** `login/page.tsx`, `login/auth-form.tsx`.
- **Steps:**
  1. Re-skin the card, brand/logo, title, fields, primary CTA, mode toggle,
     error block (`bg-destructive/10`), passkey button to the new system.
  2. Keep `signIn`/register flows + callbackUrl handling intact.
- **Acceptance criteria:** `npm run build` passes; login renders new style both
  themes; login/register/passkey flows behave unchanged; focus rings + ≥44px taps.
- **Verification:** `npm run build`; view `/login`, toggle login↔register, trigger
  an error, in light + dark.

---

## T8 — Accounts surface

- **Title:** Restyle Accounts/Cards manager and dialogs.
- **Objective:** Bring the accounts/cards lists and their dialogs into the new
  card system (icon chips, filled cards, re-themed dialogs, destructive confirm).
- **Context:** `accounts/page.tsx`, `components/accounts/*` (accounts-manager,
  account-dialog, card-dialog, confirm-delete-dialog). CRUD via existing API stays.
- **Inputs / dependencies:** T1, T2, T3.
- **Parallelizable:** yes (Wave 2; disjoint files).
- **Isolation boundary:** `accounts/page.tsx`, `src/components/accounts/*`.
- **Steps:**
  1. Restyle account/card list rows into filled cards with leading icon chips.
  2. Re-theme account-dialog, card-dialog, confirm-delete-dialog; keep the
     SelectValue label-not-id behavior; destructive token on delete.
  3. No API/data edits.
- **Acceptance criteria:** `npm run build` passes; accounts render new style both
  themes; add/edit/delete account + card flows unchanged; last4/`.tnum` preserved;
  ≥44px taps.
- **Verification:** `npm run build`; open `/accounts`, add/edit/delete an account
  and a card in light + dark.

---

## T9 — Full-app verification + visual QA

- **Title:** Integrate, build, smoke, and visually QA the whole redesign.
- **Objective:** Prove the visual-only change broke no behavior and the system is
  consistent across every surface and both themes.
- **Context:** Runs after all surfaces land. Smoke test needs a running server.
- **Inputs / dependencies:** T1–T8 complete.
- **Parallelizable:** no.
- **Isolation boundary:** no source edits except defect fixes surfaced here
  (route each fix to the owning task's file set).
- **Steps:**
  1. `npm run build` — must pass clean (lint + typecheck + compile).
  2. Start the server; run `node tests/smoke.mjs` — register → add → sort → date
     picker must pass.
  3. Manual QA matrix: `/`, `/analytics`, `/settings`, `/login`, `/accounts` ×
     {light, dark} × {375px, ≥1024px}; empty states; overdue/soon/paid; dialog
     scrim; reduced-motion on; contrast spot-check (body ≥4.5:1, secondary ≥3:1,
     gradient surfaces).
  4. Confirm no purple/pink gradient, no emoji icons, no pure-#000 dark bg,
     focus rings present everywhere.
- **Acceptance criteria:** build green; smoke green (with command output + exit
  status captured); QA matrix passes; design-system consistency confirmed across
  all surfaces.
- **Verification:** capture full output + exit status of `npm run build` and
  `node tests/smoke.mjs`; record QA matrix results in the PR description.
