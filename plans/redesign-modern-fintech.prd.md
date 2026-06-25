# PRD — Modern-Fintech Redesign (visual-only re-theme)

> Source: brainstorm (this session) + ui-ux-pro-max design intelligence.
> Tier B · Data Class D4 · Blast Radius B1. AI Mode: generate.

## Problem Statement

The app currently ships the **"Statement"** design system — editorial-minimal:
ink-on-paper, oxblood/wine accent, Schibsted + Hanken Grotesk, depth from
hairline rules and whitespace (no shadows), small radius. The product is a
personal finance commitment tracker (subscriptions, recurring bills, loans).

The owner wants a **brand-new modern-fintech visual language** in the
Monzo/Mercury/Revolut lane — confident filled cards, layered depth, a committed
accent, prominent balance numerals, and real data viz on analytics — replacing
Statement across every surface. This is a **visual-only re-theme**: no behavior,
data, money math, auth, or API changes.

## Solution

Replace the design system in two layers, exactly where the current one lives:

1. **Token layer** (`src/app/globals.css` + fonts in `src/app/layout.tsx`):
   swap palette, fonts, radius, elevation, and motion tokens. The codebase maps
   CSS vars → `@theme inline` → shadcn semantic tokens (`--primary`,
   `--card`, `--border`, …) and a set of utility classes (`.surface`,
   `.stmt-row`, `.field`, `.font-display`, `.tnum`, motion keyframes). Re-pointing
   these tokens flows the new look through every component that consumes them.

2. **Structural layer** (per component): modern fintech is not just a recolor —
   the ledger metaphor (hairline-ruled rows on a flat surface) becomes
   **filled, softly-elevated cards** with leading category icon chips, a hero
   balance treatment, and charted analytics. Each surface is restyled to the
   new patterns below.

### Locked design system (ui-ux-pro-max derived)

**Style family:** Soft UI Evolution — filled `bg-card` surfaces, soft
multi-layer shadows (real elevation scale), 12px card / 8–10px control radius,
200–300ms ease-out motion, WCAG AA+ in both themes.

**Color tokens** (replace wine/paper set; semantic names preserved):

| Role | Light | Dark |
|---|---|---|
| app background | `#F6F8FB` | `#0B1120` (deep navy, never pure black) |
| card / surface | `#FFFFFF` | `#141B2D` |
| surface-2 (subtle) | `#EEF2F8` | `#1B2438` |
| foreground (ink) | `#0B1220` | `#F1F5F9` |
| muted-foreground | `#5B6677` | `#94A3B8` |
| border / hairline | `#E3E8EF` | `rgba(255,255,255,0.08)` |
| primary (cobalt) | `#1E40AF` | `#60A5FA` |
| primary-foreground | `#FFFFFF` | `#08111F` |
| positive (paid/+) | `#059669` | `#34D399` |
| warn (due soon) | `#B45309` | `#FBBF24` |
| destructive (overdue/delete) | `#DC2626` | `#F87171` |
| ring | = primary | = primary |

Accent gradient (restrained): cobalt → cyan (`#1E40AF → #0891B2`), used **only**
on the hero total card / primary CTA. **No purple/pink gradients** (explicit
ui-ux-pro-max anti-pattern).

**Typography** (replace Schibsted + Hanken):
- System face — **IBM Plex Sans** (400/500/600/700): headings + body. Data-grade,
  trustworthy, full tabular-figure support.
- Hero money numerals — **IBM Plex Mono** (500/600), tabular: the running total
  and large balance figures. Column-aligned, ledger-precise — the distinctive move.
- `next/font/google`, `display: swap`, preserve the `--font-*` CSS-var injection
  pattern. `.font-display` / `.tnum` utilities retained, re-pointed.

**Elevation scale** (new; shadows now allowed on cards, not only overlays):
- `--elev-1` resting card, `--elev-2` hover/raised, `--elev-overlay` dialog +
  40–60% scrim. Dark mode uses its own darker shadow values.

**Surface pattern shift:** the single ruled `.surface` + `.stmt-row` ledger
becomes per-item **elevated cards** (commitment cards) with a leading
type/category icon chip, name, hero amount, and a status pill. Grouped lists
keep comfortable separation, not hairline rules.

**Charts (analytics), hand-built accessible SVG/CSS — no charting library:**
- *Monthly outlook* per currency → hero stat card (IBM Plex Mono numeral +
  per-year sub). No time-series data exists, so no line/area charts.
- *By type* → horizontal bar chart (magnitude), value labels, sorted desc.
- *By account share* → donut of monthly spend share within a currency (≤5
  accounts; bar fallback above 5). Legend + value labels; the existing numeric
  rows remain as the screen-reader/table-equivalent.
- All charts: `prefers-reduced-motion` safe, data ≥3:1 contrast, labels ≥4.5:1,
  never color-only meaning.

## User Stories

- As a user, on **`/` (Subscriptions)** I see my commitments as modern filled
  cards (icon chip, name, hero amount, due/status pill), the same sort + account
  filter behavior, and a re-themed empty state.
- As a user, on **`/analytics`** I see my monthly outlook as bold balance stat
  cards plus a by-type bar chart and per-account share donut, currency-segregated
  (no FX), with a re-themed empty state.
- As a user, on **`/settings`** I see the same controls (theme, notifications,
  passkeys, account) in the new card system with consistent forms and the
  segmented control re-themed.
- As a user, on **`/login`** I get the new brand surface (logo, fields, primary
  CTA, mode toggle, passkey button) with the new palette and type.
- As a user, on **`/accounts`** (Cards) I manage accounts/cards in new card
  lists with icon chips and re-themed dialogs.
- As a user, the **navigation** (mobile bottom dock, desktop left rail),
  **app header**, **commitment add/edit dialog**, **date picker**, **running
  total**, **buttons** and shared `ui/` primitives all adopt the new system
  consistently in light and dark.
- As a user, every money figure stays column-aligned (tabular) and never
  reflows when values change; the running-total digit-roll still plays.

## Implementation Decisions

- **Token-first.** Rewrite `globals.css` token blocks (`:root`, `.dark`,
  `@theme inline`, utility classes, keyframes) and `layout.tsx` font loaders +
  `viewport.themeColor` (update to new bg hexes) before touching components.
  Keep the no-flash inline theme script and `.dark`-on-`<html>` mechanism intact.
- **Preserve semantic token names** (`--primary`, `--card`, `--border`,
  `--destructive`, `--positive`, `--ring`, `--font-body`, `--font-display-face`)
  so components keep compiling; only their *values* change. Where components
  reference raw legacy vars (`var(--wine-soft)`, `var(--warn-tint)`), migrate
  those references to the new tokens.
- **Structural restyle per component**, no logic edits. Files in scope:
  `globals.css`, `layout.tsx`, `dashboard.tsx`, `commitment-card.tsx`,
  `commitment-dialog.tsx`, `running-total.tsx`, `tab-bar.tsx`, `app-header.tsx`,
  `date-picker.tsx`, `theme-button.tsx`, `ui/button.tsx` + touched `ui/`
  primitives, `analytics/page.tsx`, `settings-client.tsx`, `passkey-settings.tsx`,
  `pwa/notifications-settings.tsx`, `accounts/*` components + `accounts/page.tsx`,
  `login/page.tsx`, `login/auth-form.tsx`.
- **New chart components** are presentation-only React components reading the
  already-computed `computeAnalytics` output (no change to `src/lib/analytics.ts`).
- **No charting dependency added** — bars/donut are SVG/CSS.
- **Motion:** retune existing keyframes (`reveal`, `overlay-in`, `sheet-in`,
  `digit-roll`) to the new easing/elevation; keep `prefers-reduced-motion`
  disabling. No new animation libraries.
- **Accent gradient** confined to hero total + primary CTA; everything else uses
  solid tokens.
- **Tap targets stay ≥44px** on every interactive primitive (controls, filter
  chips, nav items, icon buttons, list rows). New radius/elevation must not
  shrink hit area below the floor.

## Testing Decisions

- **Proving command:** `npm run build` (Turbopack prod build = lint + typecheck
  + compile) — must pass clean.
- **Behavior preservation:** `node tests/smoke.mjs` (Playwright: register → add →
  sort → date picker) must still pass — proves the visual-only change broke no
  flows. Requires a running dev/prod server.
- **Manual visual QA** (documented in PR): both themes at 375px and desktop ≥1024px;
  empty states; overdue/due-soon/paid states; reduced-motion on; dialog scrim;
  contrast spot-check on gradient surfaces and muted text (≥4.5:1 body, ≥3:1
  large/secondary).
- No new unit tests — change is presentational; existing smoke + build are the
  regression net. (Stated explicitly per engineering rules.)

## Out of Scope

- Any change to `src/lib/*` domain logic, `src/app/api/*`, `auth.ts`/
  `auth.config.ts`/`proxy.ts`, Prisma schema/migrations, cron routes, push/
  service-worker, money math (`money.ts`), or validation.
- Adding a charting/animation library.
- New product features, new pages, or new navigation destinations.
- Historical spend tracking / time-series analytics (no such data exists).
- PWA manifest icon regeneration unless the accent brand color change requires it
  (decide at plan stage; default: leave icons, update only `themeColor`).

## Further Notes

- **Branch coordination (Dependency/Risk):** work sits on `feat/payment-accounts`
  with the Statement restyle + payment-accounts feature **unmerged**. The redesign
  re-themes those same files. Default: stack the redesign on this branch and ride
  the same PR. Large diff — expect a near-total restyle diff across `src/components`
  and `src/app`.
- **Risk — generic AI aesthetic:** modern-fintech gradients/depth can drift
  generic; hold the line per frontend rules (committed accent, intentional
  hierarchy, purposeful motion, no purple/pink gradient).
- **Risk — dark-mode contrast** on filled cards + gradient: verify independently,
  do not infer from light mode.
- **Money rule (non-negotiable):** integer minor units + ISO-4217, `.tnum`
  tabular figures on every money/date/last4 value; `RunningTotal` stays
  presentation-only.
- ui-ux-pro-max anti-patterns honored: no emoji icons (keep lucide), no removed
  focus rings, no pure-`#000` dark background, no pie chart >5 categories,
  no color-only signaling.
