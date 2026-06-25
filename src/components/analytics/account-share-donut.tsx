"use client";

import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/constants";

// Presentation-only donut over already-computed `byAccount` monthly figures.
// It shows each account's SHARE of monthly spend WITHIN A SINGLE CURRENCY —
// currencies are never mixed (no FX). The currency shown is the one carrying
// the most total monthly spend across accounts. No charting library, no money
// math beyond formatting for labels.
//
// Accessibility: the donut is aria-hidden decoration; the chart's meaning is
// carried by the visible legend (label + value + percent, never color-only) and
// the numeric account rows below it remain the full table-equivalent. Stroke
// dash transitions are guarded by prefers-reduced-motion in CSS.

type CurrencyRow = { currency: Currency; perMonthMinor: number };
type AccountRow = {
  accountId: string;
  accountName: string;
  byCurrency: CurrencyRow[];
};

// Tokenized series colors. primary (cobalt), positive (green), warn (amber),
// then a cyan drawn from the accent gradient (no dedicated token exists), then
// muted. Mapped to CSS vars so light/dark both resolve correctly.
const SERIES = [
  "var(--color-primary)",
  "var(--color-positive)",
  "var(--color-warn)",
  "#0891b2", // cyan — gradient end; no --color-* token exists for it
  "var(--color-muted-foreground)",
];

type Slice = { id: string; name: string; minor: number };

function pickCurrency(accounts: AccountRow[]): Currency | null {
  const totals = new Map<Currency, number>();
  for (const a of accounts) {
    for (const c of a.byCurrency) {
      totals.set(c.currency, (totals.get(c.currency) ?? 0) + c.perMonthMinor);
    }
  }
  let best: Currency | null = null;
  let bestTotal = -1;
  for (const [currency, total] of totals) {
    if (total > bestTotal) {
      bestTotal = total;
      best = currency;
    }
  }

  return best;
}

export function AccountShareDonut({ data }: { data: AccountRow[] }) {
  const currency = pickCurrency(data);
  if (!currency) return null;

  const slices: Slice[] = data
    .map((a) => ({
      id: a.accountId,
      name: a.accountName,
      minor: a.byCurrency.find((c) => c.currency === currency)?.perMonthMinor ?? 0,
    }))
    .filter((s) => s.minor > 0)
    .sort((a, b) => b.minor - a.minor);

  const total = slices.reduce((sum, s) => sum + s.minor, 0);
  if (slices.length === 0 || total === 0) return null;

  const pct = (minor: number) => Math.round((minor / total) * 100);
  const summary = slices
    .map((s) => `${s.name}: ${formatMoney(s.minor, currency)} per month, ${pct(s.minor)} percent`)
    .join(", ");

  // Legend is shared by both renderings.
  const legend = (
    <ul className="mt-4 space-y-2" aria-hidden>
      {slices.map((s, i) => (
        <li key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: SERIES[i % SERIES.length] }}
            />
            <span className="truncate text-foreground">{s.name}</span>
          </span>
          <span className="tnum shrink-0 font-medium text-muted-foreground">
            {pct(s.minor)}% · {formatMoney(s.minor, currency)}
          </span>
        </li>
      ))}
    </ul>
  );

  const heading = (
    <p className="text-[12px] text-muted-foreground">
      Share of monthly spend ·{" "}
      <span className="font-semibold text-foreground">{currency}</span>
    </p>
  );

  // More than 5 slices → a pie is dishonest/illegible. Fall back to stacked
  // horizontal bars (same data, same colors, clearer at high cardinality).
  if (slices.length > 5) {
    const max = slices[0]?.minor ?? 0;

    return (
      <figure className="m-0" role="img" aria-label={`Account share of monthly ${currency} spend. ${summary}.`}>
        <div className="surface mt-3 px-5 py-5">
          {heading}
          <div className="mt-4 space-y-3.5">
            {slices.map((s, i) => {
              const w = max > 0 ? Math.max(6, Math.round((s.minor / max) * 100)) : 0;

              return (
                <div key={s.id} className="animate-reveal" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-foreground">{s.name}</span>
                    <span className="tnum shrink-0 text-[13px] font-semibold text-muted-foreground">
                      {pct(s.minor)}% · {formatMoney(s.minor, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <div
                      className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-[280ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)]"
                      style={{ width: `${w}%`, background: SERIES[i % SERIES.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </figure>
    );
  }

  // ≤5 slices → SVG donut. Geometry: circumference-based stroke-dasharray on
  // concentric arcs of a single circle, each rotated to start where the prior
  // ended. r=42 in a 100×100 box, viewBox-centered.
  const r = 42;
  const c = 2 * Math.PI * r;
  // Per-slice dash length + cumulative start offset, computed purely (no
  // reassignment during render — eslint react-hooks/immutability).
  const dashes = slices.map((s) => (s.minor / total) * c);
  const offsets = dashes.map((_, i) =>
    dashes.slice(0, i).reduce((sum, d) => sum + d, 0),
  );

  return (
    <figure
      className="m-0"
      role="img"
      aria-label={`Account share of monthly ${currency} spend. ${summary}.`}
    >
      <div className="surface mt-3 px-5 py-5">
        {heading}
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
          <svg
            viewBox="0 0 100 100"
            className="size-36 shrink-0 -rotate-90"
            aria-hidden
          >
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-secondary)" strokeWidth="14" />
            {slices.map((s, i) => {
              const dash = dashes[i];

              return (
                <circle
                  key={s.id}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={SERIES[i % SERIES.length]}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offsets[i]}
                  className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)]"
                />
              );
            })}
          </svg>
          <div className="w-full min-w-0 flex-1">{legend}</div>
        </div>
      </div>
    </figure>
  );
}
