# Direction Spec — "Statement"

> Chosen by user at T0 concept gate (2026-06-25). Input artifact for all build tasks
> (T1–T9) in `plans/ui-redesign.md`. Refined editorial minimal; light-first + dark.

## Concept

A personal finance tracker that reads like a beautifully typeset bank statement. Calm,
premium, trustworthy. The numbers are the hero. Depth comes from **hairline rules and
whitespace**, not shadows. Crisp, fast, no-bounce motion.

## Palette

### Light (default)
| Token | Value | Use |
|---|---|---|
| paper | `#FBFBF9` | page bg |
| paper-raised | `#FFFFFF` | card/surface |
| ink | `#16161A` | primary text |
| ink-muted | `#6B6B73` | secondary text |
| hairline | `#E4E4DE` | rules, borders |
| hairline-strong | `#D6D6CE` | active dividers |
| cobalt | `#2540F2` | primary accent / CTA / active |
| cobalt-tint | `rgba(37,64,242,0.08)` | accent fills, focus ring halo |
| positive | `#1F7A4D` | positive/paid |
| alert | `#B4341F` | danger/overdue |
| alert-tint | `rgba(180,52,31,0.08)` | danger fills |

### Dark
| Token | Value | Use |
|---|---|---|
| paper | `#0C0C0E` | page bg |
| paper-raised | `#141417` | card/surface |
| ink | `#ECECE6` | primary text |
| ink-muted | `#9A9A93` | secondary text |
| hairline | `rgba(255,255,255,0.09)` | rules, borders |
| hairline-strong | `rgba(255,255,255,0.15)` | active dividers |
| cobalt | `#5B73FF` | primary accent |
| cobalt-tint | `rgba(91,115,255,0.14)` | accent fills, focus halo |
| positive | `#46B57E` | positive |
| alert | `#E5604B` | danger |
| alert-tint | `rgba(229,96,75,0.14)` | danger fills |

> Map onto shadcn tokens in `globals.css`: `--background`=paper, `--card`/`--popover`=paper-raised,
> `--foreground`=ink, `--muted-foreground`=ink-muted, `--border`=hairline, `--input`=hairline-strong,
> `--primary`=cobalt, `--primary-foreground`=paper, `--accent`=cobalt-tint, `--ring`=cobalt,
> `--destructive`=alert. `viewport.themeColor`: light `#FBFBF9`, dark `#0C0C0E`. `manifest.ts`
> `theme_color`/`background_color` match.

## Typography

- **Display:** `Schibsted Grotesk` (next/font/google) — headings, page titles, the running
  total. Weights 500/600/700. Tight tracking (`-0.02em` on large sizes).
- **Body:** `Hanken Grotesk` (next/font/google) — body, labels, controls. Weights 400/500/600.
- **Numerals:** ALL money + dates + last4 use `font-variant-numeric: tabular-nums` (`.tnum`
  retained). Money never reflows on update.
- `-webkit-font-smoothing: antialiased` on root. Headings `text-wrap: balance`; body `text-wrap: pretty`.
- Replace `--font-inter`/`--font-fraunces` wiring with `--font-body`/`--font-display`.

## Radius / shadow / elevation

- **Radius:** small. `--radius: 6px` (sm 4 / md 6 / lg 8 / xl 10). Concentric rule:
  outer = inner + padding on every nested surface.
- **Depth = hairlines, not shadows.** Cards/sections separated by `1px` hairline borders +
  whitespace. This intentionally overrides the generic "shadows over borders" rule for this
  direction.
- **Shadows reserved for true overlays only** (dialog, popover, dropdown): a single soft
  layered shadow, e.g. `0 1px 2px rgba(0,0,0,.04), 0 12px 32px -12px rgba(0,0,0,.18)` (light) /
  heavier in dark.
- **Statement table rows:** list items are ruled rows (hairline divider between), not floating
  cards.

## Nav model

- **Desktop (≥768px):** fixed **left rail** — icon + label, four destinations (Subs `/`,
  Analytics `/analytics`, Cards `/accounts`, Settings `/settings`). Active = cobalt text +
  cobalt left-edge marker. Content area offset right.
- **Mobile (<768px):** slim **top segmented bar** (full-width), active segment underlined in
  cobalt. No floating bottom dock.
- **Loading feedback:** preserve in-flight nav feedback (`useLinkStatus`) — active item shows
  a thin cobalt progress hint / spinner swap.
- ≥44px tap targets on all nav items.

## Signature interaction

**The running total.** Each surface that totals money shows an oversized tabular display
figure per currency (no FX merge). When commitments change (add/edit/delete/renew) the figure
**re-tallies with a digit roll** (per-digit vertical slide, ~220ms, staggered left→right).
Reduced-motion: figure cross-fades instead.

## Motion language

- Crisp + fast, **no bounce** anywhere. Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Durations: micro/hover 140ms; state change 180ms; row reveal 200ms; digit roll 220ms;
  overlay in 200ms / out 140ms.
- **Staggered list reveal on load:** rows split into chunks, ~60–80ms stagger via
  `animation-delay` (keyframe, runs once). Containers are NOT animated as one block.
- Interactive state changes use **CSS transitions** (interruptible) with explicit
  properties — never `transition: all`.

## Polish checklist (make-interfaces-feel-better → applied in T8, honored from T1)

- [ ] Concentric radius on every nested surface (outer = inner + padding).
- [ ] Optical (not geometric) centering for icons in buttons/nav.
- [ ] Hairline depth language; shadows only on overlays.
- [ ] `tabular-nums` on every dynamic/money number — no layout shift.
- [ ] `-webkit-font-smoothing: antialiased` on root.
- [ ] Headings `text-wrap: balance`; body `text-wrap: pretty`.
- [ ] `focus-visible`: 2px cobalt ring + cobalt-tint halo on every interactive element;
      never remove outline without replacement.
- [ ] Scale on press `scale(0.96)` (never <0.95) on buttons/tappable rows; `transition: scale`.
- [ ] Split + stagger enter animations (~60–80ms); subtle exits (small fixed `translateY`).
- [ ] Icon state changes via opacity/scale/blur cross-fade (no visibility toggle); motion
      library only if present in package.json (else CSS cross-fade `cubic-bezier(0.2,0,0,1)`).
- [ ] No `transition: all`; `will-change` only on transform/opacity/filter, sparingly.
- [ ] ≥44px hit area on every control (extend small ones with pseudo-element).
- [ ] **Empty states:** each surface (no commitments / no accounts / no cards) gets a quiet,
      typeset empty state — short display-font line + muted hint + primary action. Not a bare
      "nothing here".
- [ ] **Loading states:** ruled-row skeletons (hairline placeholders) matching the statement
      layout; nav in-flight feedback preserved.
- [ ] `prefers-reduced-motion: reduce` disables digit roll, staggers, and non-essential motion
      (cross-fade/instant instead).

## Hard constraints carried from PRD

- Server boundary frozen (no `src/app/api/**`, `src/lib/**`, prisma, auth, proxy, sw.js,
  push, cron edits).
- Money via `src/lib/money.ts` only; integer minor units; per-currency, no FX.
- Light/dark + system-follow + no-flash theme script preserved.
- Mobile-first, ≥44px targets, installable PWA, no-fetch-caching SW.
- No `credentialId`/public key/push endpoint/PII rendered or logged.
