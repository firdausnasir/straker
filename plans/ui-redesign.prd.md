# PRD — Commitment Tracker UI/UX Reimagining

> Source: brainstorm output (2026-06-25). Tier B · Data Class D4 · Blast Radius B1 · AI Mode generate.
> Proving command: `npm run build`.

## Problem Statement

The current UI ("Earthy Soft" — sand/parchment/terracotta, Fraunces+Inter, floating
pill dock) is to be discarded. The user wants a fresh, more UX-friendly product that is
demonstrably better than the current one: new visual language, new information
architecture, and new interaction patterns — not a reskin. All existing functionality
must survive; all money/auth/PII/PWA invariants are non-negotiable.

The work is constrained by what must NOT change: server-side domain logic, money
representation, auth/passkey server flows, zod validation boundaries, and the PWA/push
contract. The redesign is a presentation-and-IA-layer initiative riding on top of an
unchanged backend.

## Solution

A full client-layer redesign delivered in concept-then-build order:

1. **Concept phase** — `/frontend-design` proposes 2–3 distinct visual+IA directions
   (mood, type system, color, layout model, signature interaction). User selects one
   before any production build. This is a hard gate; build does not start until a
   direction is chosen.
2. **Foundation** — replace the design-token layer (`globals.css` CSS variables mapped
   onto shadcn's `--primary` etc.), swap fonts via `next/font`, preserve the no-flash
   theme script + `useTheme` infra, keep light/dark + system-follow.
3. **Component restyle** — re-theme shadcn/ui primitives (`src/components/ui/`) and
   rebuild the app components (dashboard, commitment card, commitment dialog, analytics,
   settings, passkey settings, accounts/cards, tab dock, login) against the new tokens.
4. **Polish** — `/make-interfaces-feel-better` pass: motion, hover/active states,
   optical alignment, tabular numbers for money, empty/loading states, micro-detail.
5. **Test** — rewrite `tests/smoke.mjs` selectors/flows to match the new UI so the
   end-to-end path (register → add → sort → date picker) stays green.

The new IA may regroup pages, change navigation model, and introduce new interaction
patterns, but every current feature must remain reachable.

## User Stories

- As a user, I see a fresh, cohesive visual identity with no trace of the Earthy Soft
  palette/typography.
- As a user, I can do everything I could before: list/sort subscriptions by next due
  date; add/edit/delete a commitment (name, type, amount, currency, cycle, due date,
  renewal mode, notes, reminder toggle + lead days 0–7, optional account→card link).
- As a user, I view monthly-normalized analytics totals per currency, including the
  by-account breakdown.
- As a user, I manage payment accounts and their cards (label, last4, network) and link
  commitments to a specific card.
- As a user, I manage settings: theme override (system/light/dark), notification
  enablement per device, and passkey add/renew/rename/delete with password re-prove.
- As a user, I log in with email/password or passkey, and register a new account.
- As a user on mobile, every control is ≥44px, the app is installable as a PWA, and due
  dates are never stale (no fetch-caching SW).
- As a user, the app respects my OS theme by default and lets me override it live.

## Implementation Decisions

> The decisions below are technical choices derived from the confirmed requirements
> (notably "build on shadcn/ui + Tailwind v4 — restyle, not replace" and "full
> functional parity"); they are HOW, not new product requirements.

- **Stack unchanged**: Next.js 16 (App Router, Turbopack), React 19, TypeScript,
  Tailwind v4, shadcn/ui, lucide-react. *Derived from "restyle, not replace":* keep the
  existing UI dependency set; any new UI dependency is a deviation to be surfaced for
  approval during planning rather than added silently.
- **Token-first**: *chosen as the mechanism for "restyle, not replace"* — the new design
  system lives as CSS custom properties in `globals.css`, mapped onto the shadcn token
  names so primitives inherit the new look. Centralized and reversible. (If planning
  finds a better mechanism, it may substitute; the requirement is the restyle, not this
  technique.)
- **Fonts**: replace Fraunces/Inter with the chosen direction's type system via
  `next/font/google` (or `next/font/local`), keeping `--font-*` variable wiring in
  `layout.tsx`. `.tnum` tabular-numbers hook for money must be preserved or replaced
  with an equivalent.
- **Theme infra preserved**: the no-flash inline `themeScript` and `useTheme`
  (`useSyncExternalStore`) stay; only the resolved color values change. `viewport`
  `themeColor` light/dark hex values update to the new palette.
- **Navigation**: the redesign may replace the floating pill dock with a new nav model,
  but must keep all four destinations reachable (Subs `/`, Analytics `/analytics`,
  Cards `/accounts`, Settings `/settings`). *Per full functional parity:* the existing
  in-flight nav loading feedback (`useLinkStatus` spinner) is current behavior, so it is
  preserved or replaced with an equivalent — not silently dropped.
- **Server boundary untouched**: no changes to route handlers' logic, `src/lib/*` domain
  modules (`money`, `cycle`, `dates`, `commitments`, `analytics`, `accounts`,
  `validation`, `auth`), Prisma schema, NextAuth/passkey server flows, or the cron/push
  contract. Edits are limited to the presentation layer (`src/app/**/page.tsx` render
  output, `src/components/**`, `globals.css`, `layout.tsx`, `manifest.ts` theme/brand
  values, icons if the brand mark changes).
- **DTO contracts stable**: components keep consuming the existing `CommitmentDTO`,
  account/card DTO shapes from `page.tsx` / API routes — no server DTO reshape to serve
  the new UI.
- **Money rule**: amounts render via `src/lib/money.ts` formatting only; never reformat
  with float/`parseFloat`. Multi-currency totals stay per-currency (no FX).
- **PII/secret hygiene**: no `credentialId`, public key, push endpoint, or raw PII
  rendered into logs or debug output during the rebuild.
- **Accessibility floor**: ≥44px tap targets on all interactive primitives; `aria-current`
  / focus-visible states preserved or improved.
- **Concept gate is mandatory**: planning must encode the `/frontend-design` selection as
  an explicit pre-build task whose output (chosen direction + token spec) feeds every
  later build task.

## Testing Decisions

- **Proving command**: `npm run build` must pass (typecheck + production build).
- **Smoke test rewrite**: `tests/smoke.mjs` (Playwright: register → add commitment →
  sort by due date → date picker) is updated to the new selectors/flows and must pass
  against a running server. New stable selectors (e.g. `data-testid` or accessible
  roles/names) should be introduced so future restyles don't break the test.
- **Manual visual verification**: light + dark mode across all five surfaces; mobile
  viewport tap-target check; empty states (no commitments / no accounts / no cards);
  PWA install + no-stale-due-date behavior.
- **No new server tests required** — server logic is unchanged; coverage stays as-is.

## Out of Scope

- Any change to server-side domain logic, API route behavior, Prisma schema, migrations,
  auth/passkey server flows, cron routes, or push/VAPID contract.
- New features beyond current parity (full functional parity is required; no additions
  and — per user — no feature drops without explicit PRD-time approval, which was not
  granted, so: no drops).
- Adding FX/currency conversion.
- Changing the money representation (integer minor units + ISO-4217 stays).
- Backend performance, infra, deploy, or Docker/CI changes.

## Further Notes

- The accounts/cards UI is WIP on the active `feat/payment-accounts` branch; the redesign
  layers on top of it and includes it in the reimagining (it is already wired as the
  "Cards" tab).
- Because the visual direction is chosen during the concept phase, the plan must treat
  the selected direction's token/type/layout spec as an input artifact to the build
  tasks, not pre-bake a specific palette here.
- Risk to watch during planning: "full reimagining" is broad — the plan must bound IA
  changes to an explicit page/nav inventory so scope stays controlled.
