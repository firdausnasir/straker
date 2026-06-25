# Implementation Plan — Commitment Tracker UI/UX Reimagining

> Source: `plans/ui-redesign.prd.md` (passed prd-review). Tier B · D4 · B1 · AI Mode generate.
> Global proving command: `npm run build`. End-to-end proving: `node tests/smoke.mjs` against a running server.

## Durable decisions

- **Token-first restyle.** `src/app/globals.css` already maps a private palette → shadcn
  semantic tokens (`--background`, `--primary`, …) via `@theme inline`. The redesign
  replaces the palette/shadow/motion/typography values behind those token names; shadcn
  primitives inherit automatically. This is the single foundation every surface depends on.
- **Server boundary frozen.** No edits to `src/app/api/**`, `src/lib/**`, `prisma/**`,
  `src/auth*.ts`, `src/proxy.ts`, `public/sw.js`, push, or cron. DTO shapes consumed by
  components (`CommitmentDTO`, account/card summaries) stay as-is.
- **Theme infra preserved.** `layout.tsx` no-flash `themeScript`, `theme.tsx` `useTheme`
  (useSyncExternalStore), `.dark` class model, system-follow — kept; only resolved values
  + fonts change. `viewport.themeColor` + `manifest.ts` brand colors update to new palette.
- **Concept gate is blocking.** No production styling lands until the user picks one of the
  `/frontend-design` directions. That choice yields a written **Direction Spec**
  (palette, type system, radius/shadow language, layout model, signature interaction,
  motion language) that is the input artifact to every build task.
- **Shared primitives owned by Foundation.** `src/components/ui/*` (shadcn) + `globals.css`
  + theme infra are restyled in one task so parallel surface tasks never touch the same
  unstable file.

## Execution contract

- **Chosen pattern:** parallel-waves. Strict dependency between waves; Wave 2 surfaces run
  parallel-independent on disjoint file sets.
- **Task graph:**
  - `T0 Concept gate` → (blocks everything)
  - `T1 Foundation` (tokens + fonts + ui primitives) → (blocks Wave 2)
  - Wave 2 (parallel): `T2 Subs`, `T3 Analytics`, `T4 Settings`, `T5 Accounts`, `T6 Login`, `T7 Nav+Shell`
  - `T8 Polish pass` (make-interfaces-feel-better) → after Wave 2 (touches all surfaces, single-threaded)
  - `T9 Smoke-test rewrite` → after T8
- **Ownership boundaries:** see each task's Isolation boundary. No two Wave-2 tasks share a
  file. `globals.css` + `ui/*` + `theme*.tsx` are frozen after T1 (read-only for Wave 2);
  if a surface needs a new shared primitive variant, it is surfaced to T1 owner, not edited
  in place.
- **Dependencies:** T1 depends on T0's Direction Spec. All Wave-2 tasks depend on T1. T8
  depends on all Wave-2. T9 depends on T8.
- **Acceptance (global):** `npm run build` green; light+dark verified on every surface;
  full functional parity (no feature removed); no server file changed; smoke test green.
- **Per-task proving command:** listed under each task's Verification.

---

## T0 — Concept gate: choose the visual+IA direction

- **Title:** Concept gate — `/frontend-design` proposes directions, user picks one
- **Objective:** Produce a single written **Direction Spec** that all build tasks consume.
- **Context:** PRD requires discarding "Earthy Soft" and a full reimagining (visuals + IA +
  interactions). `/frontend-design` generates 2–3 distinct concept directions;
  `/make-interfaces-feel-better` informs the polish vocabulary captured in the spec.
- **Inputs / dependencies:** `plans/ui-redesign.prd.md`; current surface inventory;
  `/frontend-design`, `/make-interfaces-feel-better` skills.
- **Parallelizable:** no (blocking gate).
- **Isolation boundary:** writes only `plans/ui-redesign.direction.md`. No source edits.
- **Steps:**
  1. Invoke `/frontend-design`; generate 2–3 directions, each with: palette (light+dark),
     type system (display + body via next/font), radius/shadow/elevation language, layout
     model (nav model + page composition), one signature interaction, motion language.
  2. Present directions to the user; obtain explicit pick (hard gate).
  3. Run `/make-interfaces-feel-better` against the chosen direction to capture the polish
     checklist (motion timings, optical alignment, tabular-num rule, empty/loading states).
  4. Write the consolidated **Direction Spec** to `plans/ui-redesign.direction.md`.
- **Acceptance criteria:** user has selected exactly one direction; `direction.md` contains
  concrete light+dark token values, font choices, nav model, and the polish checklist.
- **Verification:** user confirms the selected direction in chat; `direction.md` exists and
  is complete. No build (no source changed).

## T1 — Foundation: token system, fonts, shadcn primitives

- **Title:** Foundation restyle — globals.css tokens + layout fonts + ui/* primitives
- **Objective:** Re-express the chosen direction as the shared token + primitive layer so
  every surface inherits it.
- **Context:** `globals.css` maps a private palette → shadcn tokens via `@theme inline`;
  `layout.tsx` injects fonts + theme script + `viewport.themeColor`; `manifest.ts` carries
  brand colors; `src/components/ui/*` are shadcn primitives keyed off the tokens.
- **Inputs / dependencies:** T0 `direction.md`. Tailwind v4 + shadcn (no new deps).
- **Parallelizable:** no (blocks Wave 2).
- **Isolation boundary:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/manifest.ts`,
  `src/components/ui/*.tsx`, and theme infra (`src/components/theme.tsx`,
  `src/components/theme-button.tsx`) ONLY. These files are frozen for all later tasks.
- **Steps:**
  1. Replace the palette, shadow, radius, and motion blocks in `globals.css` (`:root` +
     `.dark`) with the Direction Spec values; keep the shadcn token names + `@theme inline`
     wiring intact. Keep/replace `.tnum`, `.surface*`, `.field`, animation utilities to
     match the new language.
  2. Swap fonts in `layout.tsx` via `next/font` per spec; keep `--font-*` variable wiring,
     `suppressHydrationWarning`, and the no-flash `themeScript` untouched in behavior.
     Update `viewport.themeColor` light/dark hex to the new palette.
  3. Update `manifest.ts` `theme_color`/`background_color` (and brand icon refs only if the
     mark changes) to the new palette.
  4. Restyle `ui/*` primitives (button, input, select, dialog, card, badge, switch, tabs,
     popover, calendar, dropdown-menu, alert-dialog, label, textarea, sonner) to the new
     variants. Preserve all props/APIs and ≥44px tap targets.
  5. Preserve `theme.tsx`/`theme-button.tsx` behavior; restyle the toggle visuals only.
- **Acceptance criteria:** `npm run build` green; light+dark toggle works with no flash;
  shadcn primitives render in the new language; no API/prop of any primitive changed; no
  server file touched.
- **Verification:** `npm run build`; manual light/dark toggle on `/login` (no auth needed)
  + one authed page; confirm theme switch + system-follow.

## T2 — Subs surface (dashboard + commitment CRUD)

- **Title:** Rebuild the Subs/home surface
- **Objective:** Reimagine the commitments list, card, add/edit dialog, and date picker.
- **Context:** `/` renders `Dashboard` from a `CommitmentDTO[]`; list sorts by next due
  date; card shows meta incl. linked card; dialog edits all fields (name, type, amount,
  currency, cycle, due date, renewal mode, notes, reminder toggle + lead days 0–7, optional
  account→card picker); `date-picker.tsx` wraps the calendar.
- **Inputs / dependencies:** T1 foundation (frozen tokens/primitives); existing DTO + API.
- **Parallelizable:** yes (Wave 2).
- **Isolation boundary:** `src/components/dashboard.tsx`, `src/components/commitment-card.tsx`,
  `src/components/commitment-dialog.tsx`, `src/components/date-picker.tsx`. May edit the
  render output of `src/app/page.tsx` (JSX wrapper only — NOT the DTO mapping/auth). Reads
  `ui/*` but does not edit it.
- **Steps:**
  1. Rebuild `dashboard.tsx` layout/empty-state per Direction Spec; keep sort-by-due-date
     and the account filter behavior.
  2. Rebuild `commitment-card.tsx` (collapsed/expanded meta, linked-card display, money via
     `src/lib/money.ts` + `.tnum`/equivalent).
  3. Rebuild `commitment-dialog.tsx` form layout; keep all fields, zod-validated submit,
     reminder lead-day picker (0–7), and the account→card picker dependency + label mapping.
  4. Restyle `date-picker.tsx` against the new calendar primitive.
- **Acceptance criteria:** add/edit/delete/sort/reminder/card-link all work; money never
  reformatted with float; empty state styled; `npm run build` green.
- **Verification:** `npm run build`; manual add→sort→edit→link-card in light+dark.

## T3 — Analytics surface

- **Title:** Rebuild the Analytics surface
- **Objective:** Reimagine monthly-normalized per-currency totals + by-account breakdown.
- **Context:** `analytics/page.tsx` renders totals from `computeAnalytics`; per-currency, no
  FX; includes by-account section.
- **Inputs / dependencies:** T1 foundation; existing analytics lib output (unchanged).
- **Parallelizable:** yes (Wave 2).
- **Isolation boundary:** `src/app/analytics/page.tsx` ONLY (render/layout; not the lib call
  contract). Reads `ui/*`, does not edit.
- **Steps:**
  1. Rebuild the page layout per Direction Spec; keep per-currency grouping (no FX merge).
  2. Restyle the by-account breakdown; tabular numbers for amounts.
  3. Style the empty state (no commitments).
- **Acceptance criteria:** totals render per currency + by account; money tabular + exact;
  empty state styled; `npm run build` green.
- **Verification:** `npm run build`; manual view with multi-currency data in light+dark.

## T4 — Settings surface (theme, notifications, passkeys)

- **Title:** Rebuild the Settings surface
- **Objective:** Reimagine theme override, notification enablement, and passkey management.
- **Context:** `settings/page.tsx` → `settings-client.tsx` hosts theme override
  (system/light/dark), `pwa/notifications-settings.tsx` (per-device enable),
  `passkey-settings.tsx` (add/renew/rename/delete with password re-prove + guessed device
  name modal). Server passkey/push flows are frozen.
- **Inputs / dependencies:** T1 foundation; existing passkey/push client calls (unchanged).
- **Parallelizable:** yes (Wave 2).
- **Isolation boundary:** `src/app/settings/page.tsx`, `src/components/settings-client.tsx`,
  `src/components/passkey-settings.tsx`, `src/components/pwa/notifications-settings.tsx`.
  Reads theme infra + `ui/*`, does not edit them.
- **Steps:**
  1. Rebuild settings layout/sections per Direction Spec.
  2. Restyle theme override control (wire to existing `useTheme`).
  3. Restyle notifications enable/disable + permission states.
  4. Restyle passkey list + add/renew/rename/delete flows; keep password re-prove modal +
     guessed device-name pre-fill; never render credentialId/public key.
- **Acceptance criteria:** theme override + system-follow work; notification toggle works;
  passkey flows intact incl. password re-prove; no secret/PII rendered; `npm run build` green.
- **Verification:** `npm run build`; manual theme switch + passkey rename in light+dark.

## T5 — Accounts/Cards surface

- **Title:** Rebuild the Accounts/Cards surface
- **Objective:** Reimagine account + card management (the "Cards" tab).
- **Context:** `accounts/page.tsx` → `accounts/accounts-manager.tsx` with
  `account-dialog.tsx`, `card-dialog.tsx`, `confirm-delete-dialog.tsx`. Card stores
  label/last4/network only (no PAN). All CRUD is user-scoped + zod-validated server-side
  (frozen).
- **Inputs / dependencies:** T1 foundation; existing accounts API (unchanged).
- **Parallelizable:** yes (Wave 2).
- **Isolation boundary:** `src/app/accounts/page.tsx`, `src/components/accounts/*.tsx`.
  Reads `ui/*`, does not edit.
- **Steps:**
  1. Rebuild accounts-manager layout/empty states per Direction Spec.
  2. Restyle account + card create/edit dialogs (keep label/last4/network fields, no PAN).
  3. Restyle delete-confirm dialog.
- **Acceptance criteria:** account/card CRUD works; last4/network display only; empty states
  styled; `npm run build` green.
- **Verification:** `npm run build`; manual add account→add card→delete in light+dark.

## T6 — Login/auth surface

- **Title:** Rebuild the Login surface
- **Objective:** Reimagine login + register + passkey-login entry.
- **Context:** `login/page.tsx` → `login/auth-form.tsx` handles email/password sign-in,
  registration (`/api/register`), and the passkey login button (`signIn("passkey")`).
  Auth server flows frozen.
- **Inputs / dependencies:** T1 foundation; existing auth client calls (unchanged).
- **Parallelizable:** yes (Wave 2).
- **Isolation boundary:** `src/app/login/page.tsx`, `src/app/login/auth-form.tsx`. Reads
  `ui/*`, does not edit.
- **Steps:**
  1. Rebuild the login/register layout per Direction Spec (this is the unauthed first
     impression — high polish).
  2. Restyle email/password + register toggle + error states.
  3. Restyle the passkey login button.
- **Acceptance criteria:** sign-in, register, and passkey login all work; error states
  styled; `npm run build` green.
- **Verification:** `npm run build`; manual register→logout→login + passkey in light+dark.

## T7 — Nav + app shell

- **Title:** Rebuild navigation + shared shell
- **Objective:** Reimagine the nav model (replacing the floating pill dock) + app header.
- **Context:** `tab-bar.tsx` is the bottom pill dock with 4 destinations (Subs `/`,
  Analytics, Cards `/accounts`, Settings) + `useLinkStatus` in-flight spinner;
  `app-header.tsx` is the shared header. Full parity: all four destinations reachable, nav
  loading feedback preserved or equivalent.
- **Inputs / dependencies:** T1 foundation; Direction Spec nav model.
- **Parallelizable:** yes (Wave 2) — owns nav files only; no overlap with surface tasks.
- **Isolation boundary:** `src/components/tab-bar.tsx`, `src/components/app-header.tsx`.
  Reads `ui/*` + theme infra, does not edit.
- **Steps:**
  1. Implement the new nav model per Direction Spec; keep all four routes + `aria-current`.
  2. Preserve or replace the `useLinkStatus` in-flight loading feedback.
  3. Rebuild `app-header.tsx` to match.
- **Acceptance criteria:** all four routes reachable + active state correct; nav loading
  feedback present; ≥44px targets; `npm run build` green.
- **Verification:** `npm run build`; manual navigate all tabs in light+dark on mobile width.

## T8 — Polish pass (make-interfaces-feel-better)

- **Title:** Cross-surface polish pass
- **Objective:** Apply the Direction Spec polish checklist consistently across all surfaces.
- **Context:** Per-surface tasks deliver structure + style; this pass unifies micro-detail
  (motion timings, hover/active/focus-visible, optical alignment, tabular numbers, enter/
  exit animations, empty/loading states, reduced-motion).
- **Inputs / dependencies:** all Wave-2 tasks complete; T0 polish checklist;
  `/make-interfaces-feel-better`.
- **Parallelizable:** no (touches multiple surfaces; run single-threaded to avoid conflicts).
- **Isolation boundary:** any presentation file already in scope (Wave-2 surfaces + nav).
  Still NO server files; `globals.css`/`ui/*` shared-token edits allowed here since Wave 2
  is done (no parallel writers remain).
- **Steps:**
  1. Walk the polish checklist per surface; fix motion, optical alignment, focus-visible,
     tabular numbers on all money, empty/loading states.
  2. Verify `prefers-reduced-motion` disables non-essential motion.
  3. Resolve any visual inconsistency between surfaces.
- **Acceptance criteria:** polish checklist satisfied on every surface; reduced-motion
  respected; `npm run build` green.
- **Verification:** `npm run build`; manual sweep of all surfaces light+dark + reduced-motion.

## T9 — Smoke-test rewrite

- **Title:** Update Playwright smoke test to the new UI
- **Objective:** Keep the end-to-end path (register → add → sort → date picker) green.
- **Context:** `tests/smoke.mjs` drives the old selectors; the redesign changes them. Introduce
  stable hooks (`data-testid` or accessible roles/names) so future restyles don't break it.
- **Inputs / dependencies:** all UI tasks complete (T1–T8); running dev/prod server.
- **Parallelizable:** no (final gate).
- **Isolation boundary:** `tests/smoke.mjs` plus minimal `data-testid`/aria additions to the
  exact elements the test targets (no behavior change).
- **Steps:**
  1. Run the existing test against the new UI; capture every selector break.
  2. Add stable test hooks to the targeted elements where needed.
  3. Rewrite selectors/flows; keep the register→add→sort→date-picker scenario.
- **Acceptance criteria:** `node tests/smoke.mjs` passes against a running server; scenario
  coverage unchanged; only test hooks (not behavior) added to components.
- **Verification:** start a server (`npm run build` + start, or `npm run dev`), then
  `node tests/smoke.mjs`; confirm exit 0.
