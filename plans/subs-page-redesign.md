# Plan — Subs Page Redesign

Friendlier, denser subscriptions list. Replaces the flat stack of tall expandable
cards with: compact ledger rows (two-line on mobile), a per-currency monthly
summary header with a next-due callout, urgency-grouped sections with counts,
sort-within-group, live search (name + notes), and quick type-filter chips
alongside the existing account pills.

## Durable decisions (fixed before implementation)

- **Scope:** client-side presentation only. No API, schema, `lib/commitments`
  write-path, `lib/money`, or `lib/analytics` logic changes. Touch
  `dashboard.tsx`, `commitment-card.tsx`, and one new `summary-header.tsx`.
- **Design system:** Earthy Soft / modern-fintech is preserved, not redesigned —
  terracotta `--primary`, Fraunces display, Inter body, `.font-num` mono numerals,
  `surface` cards, `--shadow-card`, light/dark. Reuse existing tokens only.
- **Money:** `formatMoney(amountMinor, currency)`. No float, no FX — one total per
  currency. Tabular numerals (`.font-num` / `tnum`).
- **Urgency groups (3 visible):** map existing `urgencyOf` — which returns
  `overdue` (days<0), `soon` (days≤3), `upcoming` (days≤14), `later` (>14) — to
  **Overdue** (`overdue`), **Due soon** (`soon` + `upcoming`, i.e. days 0–14),
  **Later** (`later`). These exact thresholds live in `src/lib/dates.ts`
  (`urgencyOf`); no new thresholds are introduced.
- **Type-filter chip set (verified):** `COMMITMENT_TYPES` in
  `src/lib/constants.ts` is exactly `["subscription","recurring","loan","other"]`
  with `TYPE_LABELS` mapping to the brainstorm names (Subscriptions / Recurring /
  Loans / Other — confirm exact plural label text against `TYPE_LABELS` at impl
  time and use those strings verbatim, do not hardcode new ones). Chips = `All`
  + one per `COMMITMENT_TYPES` entry. No category invented or omitted.
- **Summary scope:** the summary header reflects the **full unfiltered** commitment
  set — it is the stable "your monthly outlook + what's next" anchor, independent
  of search/filter/sort. Per-currency monthly totals come from
  `computeAnalytics(commitments).byCurrency` (`perMonthMinor`). Next-due = the
  single commitment with the earliest `nextDueDate` (most-overdue-or-soonest),
  shown as name + `dueLabel`.
- **Filter/sort order of operations (Task C):** search → type filter → account
  filter → group by urgency → sort within each group by the active sort mode.
- **Sort + group interaction:** grouping is always on; the existing sort control
  (due / amount / name) orders items *within* each group. Default sort = `due`.
- **Row interaction:** compact row stays tap-to-expand; the expanded action row
  (renew/advance, edit, delete) and all dialogs are preserved unchanged.
- **Empty states:** three distinct states — (1) genuine zero commitments, (2)
  account/type filter matches none, (3) search matches none (with a clear-search
  affordance). Restyle in `surface`, reuse existing copy where it fits.
- **No virtualization:** single-user local app; list sizes are small. Skipped on
  purpose (`virtualize-lists` only matters at 50+ items and adds complexity here).

---

## Task A — Compact ledger row

**Objective**
Convert `CommitmentCard` from a tall card into a compact, single-line ledger row
(two-line on mobile) that keeps tap-to-expand and all current actions.

**Context**
`src/components/commitment-card.tsx` is a self-contained client component rendering
one `CommitmentDTO`. Today row 1 = type chip + name + amount; row 2 = due pill +
cycle/renewal + chevron; row 3 = linked card; expandable region = notes + 3 action
buttons. It already imports `urgencyOf`, `dueLabel`, `formatDueDate`, `formatMoney`,
the `TYPE_ICON` map, and `URGENCY_PILL`. The redesign compresses the resting state;
the expanded region (notes + actions + dialogs) is unchanged.

**Inputs / dependencies**
- `src/components/commitment-card.tsx` (rewrite resting layout only)
- `@/lib/dates` (`urgencyOf`, `dueLabel`, `formatDueDate`, `Urgency`)
- `@/lib/money` (`formatMoney`), `@/lib/constants` (`TYPE_LABELS`, `CYCLE_LABELS`)
- No dependency on other tasks.

**Parallelizable:** yes
**Isolation boundary:** owns `src/components/commitment-card.tsx` only. Must NOT
edit `dashboard.tsx`. Public component signature `({ commitment }: { commitment:
CommitmentDTO })` stays identical so Task C needs no change.

**Steps**
1. Resting layout → a single flex row, min tap target ≥44px:
   - Leading: keep the cobalt/primary-tinted type-icon chip, shrink to `size-9`.
   - Name: `truncate` on desktop single line.
   - Trailing: `formatMoney` amount in `.font-num`, then a compact due indicator
     (`dueLabel`), then the chevron.
2. **Stronger overdue/soon signal:** add a left accent edge (e.g. a 3px inset
   ruled border / `before:` bar) tinted by urgency — `destructive` for overdue,
   `warn` for soon, none/calm for later. Reuse existing `URGENCY_PILL` color
   tokens; do not invent new colors. Keep a text/icon cue too (not color alone).
3. **Two-line on mobile only:** name on line 1; amount + `dueLabel` on line 2;
   collapse to one line at the `sm:` breakpoint (Tailwind 640px). Rationale:
   portrait phones (375–430px) fall below 640px and get the safe two-line layout;
   tablets/desktop (≥640px) get the single line. Never truncate amount or due.
   Use Tailwind responsive utilities, no JS breakpoint. (If 640px proves too eager
   on large phones in landscape, bump to `md:` — but default to `sm:`.)
4. Move cycle + renewal (Auto/Manual) and the linked-card line into the expanded
   region (they are detail, not glance-level) — or keep as a muted sub-line if it
   fits the two-line budget; prefer the expand region to maximize density.
5. Keep the expandable grid-rows `0fr→1fr` transition, notes, the 3 action buttons,
   the delete `AlertDialog`, and the edit `CommitmentDialog` exactly as-is.
6. Preserve a11y: `aria-expanded`, `aria-label`/`title` on icon buttons, focus
   rings, 200ms `cubic-bezier(0.2,0,0,1)` transitions.

**Acceptance criteria**
- Resting row height is materially shorter than the current card (target: roughly
  half) on desktop; two clean lines on a 375px viewport with no truncated amount.
- Overdue and due-soon rows are visually distinct from later rows at a glance via
  a non-color-only cue.
- Tap toggles expand; renew/advance, edit, delete and both dialogs work unchanged.
- Light + dark both legible (text ≥4.5:1, accent edge visible in both themes).
- Component signature unchanged.

**Verification**
- `npm run build` passes (type + lint clean for this file).
- Manual: with dev server, expand/collapse a row, mark-paid/advance, edit, delete;
  toggle dark mode; check 375px two-line render.

---

## Task B — Summary header component

**Objective**
A new presentational `SummaryHeader` band: per-currency monthly total + a next-due
callout, in the Earthy Soft system.

**Context**
The dashboard currently has only a title + count subheader. `/analytics` already
renders per-currency `perMonthMinor` hero cards from
`computeAnalytics(commitments).byCurrency`; this task makes a smaller, denser
inline version for the top of the subs list. `computeAnalytics` is a pure function
over `CommitmentDTO[]` and is safe to call client-side.

**Inputs / dependencies**
- New file `src/components/summary-header.tsx` (client or pure presentational).
- `@/lib/analytics` (`computeAnalytics`, type `CurrencyTotal`)
- `@/lib/money` (`formatMoney`), `@/lib/dates` (`dueLabel`)
- `@/lib/types` (`CommitmentDTO`)
- No dependency on Task A or C beyond the agreed prop contract below.

**Parallelizable:** yes
**Isolation boundary:** owns `src/components/summary-header.tsx` only. Must NOT edit
`dashboard.tsx` or `commitment-card.tsx`. Export contract Task C will import:
`export function SummaryHeader({ commitments }: { commitments: CommitmentDTO[] })`.

**Steps**
1. Compute inside the component (keeps Task C wiring trivial), memoized with
   `useMemo` keyed on `commitments` so `computeAnalytics` runs once per data change,
   not every render: call `computeAnalytics(commitments).byCurrency` for per-currency
   `perMonthMinor`; find the earliest-`nextDueDate` commitment for the next-due
   callout. `computeAnalytics` is a pure, already-exported function — safe and cheap
   for these small single-user lists.
2. Layout: a compact `surface` band. Per-currency monthly figure(s) in `.font-num`,
   prefixed `≈` (consistent with analytics), each labelled with its ISO code. With
   one currency show it prominently; with two (MYR/USD) show both compactly side by
   side — never sum across currencies.
3. Next-due callout: `"Next: {name} · {dueLabel(date)}"`. If the earliest item is
   overdue, reflect that via `dueLabel` ("N days late") and the urgency accent.
4. Guard: if `commitments` is empty, return `null` (the dashboard empty state owns
   that case). Integration contract for Task C: `SummaryHeader` always receives the
   **full unfiltered** `commitments` array — never the filtered/searched subset — so
   it never has to react to search/filter emptiness; only the genuine zero-list case
   returns `null`. Task C must not pass a filtered array here.
5. Use the existing reveal/animation idiom (`animate-reveal`) for parity, respecting
   `prefers-reduced-motion` via the existing global handling.

**Acceptance criteria**
- Shows correct per-currency monthly totals (matches `/analytics` figures for the
  same data) and never mixes currencies.
- Next-due names the single earliest-due commitment with a correct relative label.
- Returns `null` for an empty list.
- Legible in light + dark; numerals tabular; ≈ prefix consistent with analytics.

**Verification**
- `npm run build` passes.
- Manual: seed multiple currencies + an overdue item; confirm totals equal the
  analytics page and the callout names the earliest item.

---

## Task C — Dashboard orchestration (search, filters, grouping, integration)

**Objective**
Rebuild `Dashboard` to host the summary header, live search, type-filter chips +
account pills, urgency grouping with counts, sort-within-group, and the compact
rows — including all three empty states.

**Context**
`src/components/dashboard.tsx` is the client component receiving `commitments:
CommitmentDTO[]`. It currently does account-filter + sort via `useMemo` and renders
a flat `<ul>` of `CommitmentCard`. This task is the integration point and the single
owner of the dashboard's list logic; it consumes Task A's compact row and Task B's
`SummaryHeader` through their stable signatures.

**Inputs / dependencies**
- `src/components/commitment-card.tsx` (Task A — consumed, not edited)
- `src/components/summary-header.tsx` (Task B — consumed, not edited)
- `@/lib/dates` (`urgencyOf`), `@/lib/constants` (`COMMITMENT_TYPES`, `TYPE_LABELS`)
- Existing UI: `DropdownMenu` (sort), `Button`, `cn`, `TabBar`, `CommitmentDialog`
- Depends on Task A and Task B being merged first (or their signatures honored).

**Parallelizable:** no (depends on A + B; sole owner of `dashboard.tsx`).
**Isolation boundary:** owns `src/components/dashboard.tsx` only. Does not modify
`commitment-card.tsx` or `summary-header.tsx`.

**Steps**
1. Render `<SummaryHeader commitments={commitments} />` below the title header (it
   takes the full unfiltered list). Ensure it does not overlap the fixed top
   nav — the existing `pt-7` / shell offset already reserves space; keep it.
2. Add state: `query` (search), `typeFilter` (a `CommitmentType | "all"`),
   keep existing `account` and `sort`.
3. **Search:** a text input (top of controls) filtering on `name` + `notes`
   (case-insensitive `includes`). Debounce input (~150–200ms) or filter directly
   given small lists; if direct, keep it in a `useMemo`. Add a clear (×) affordance.
4. **Type-filter chips:** reuse the module-local `FilterPill` component already
   defined inside `dashboard.tsx` (same file Task C owns) — call it directly, no
   extraction or duplication needed. Row of
   `All / Subscriptions / Recurring / Loans / Other` from `COMMITMENT_TYPES` +
   `TYPE_LABELS`. Render alongside (above) the existing account pills; both stay
   horizontally scrollable, `aria-pressed`, ≥44px. Account pills behavior unchanged.
5. **Pipeline (in `useMemo`s), strict order:** search → type filter → account
   filter → produce one filtered list → bucket into Overdue / Due soon / Later via
   the `urgencyOf` mapping (overdue→Overdue; soon|upcoming→Due soon; later→Later).
   Sort is applied **after** grouping — each bucket is sorted independently by the
   active `sort` mode (due/amount/name). Never sort before bucketing (would not
   change buckets but keep the order explicit to avoid confusion).
6. **Render groups:** define the three buckets in fixed order [Overdue, Due soon,
   Later]. Render a section **only when `bucket.length > 0`** — empty buckets emit no
   header and no element (e.g. an all-`later` list shows just the "Later" section,
   no zero-count "Overdue"/"Due soon" headers). Each rendered section = a header with
   label + count (e.g. `Due soon · 3`), then a `space-y-2` list of compact rows. Keep
   the `animate-reveal` stagger but reset the index per group so delays stay short.
7. Update the subheader count line to reflect the filtered total; keep "sorted by".
8. **Empty states (three):**
   - Zero commitments → existing `EmptyState` (restyled if needed).
   - Commitments exist but filters/account match none → the existing "Nothing in
     this account"-style state, generalized to "No matches for these filters".
   - Search query active with zero matches → a "No results for '{query}'" state
     with a button/link to clear the search.
9. Keep the add (`+`) button, sort dropdown, `CommitmentDialog` add flow, and
   `router.refresh()` on save exactly as-is.

**Acceptance criteria**
- Items render grouped under Overdue / Due soon / Later with correct counts; empty
  groups are hidden; sort reorders within each group.
- Search filters live on name + notes and has a working clear affordance; a no-match
  query shows the dedicated no-results state.
- Type chips and account pills both filter correctly and compose (AND) with search;
  active states are visible; all ≥44px and keyboard reachable.
- Summary header shows the full-list outlook regardless of active filters.
- All three empty states reachable and visually distinct.
- Add / sort / row actions / dialogs all still work; no console errors.
- Light + dark legible; no horizontal page scroll at 375px.

**Verification**
- `npm run build` passes (proving command).
- `node tests/smoke.mjs` against a running server (register → add → sort → date
  picker). If the redesign moved the sort control or list selectors, update the
  smoke selectors in the same change and note it; report exact pass/fail output.
- Manual at 375px + desktop, light + dark: search a term, clear it, toggle each type
  chip and account pill, confirm grouping + counts, expand a row and run an action.
