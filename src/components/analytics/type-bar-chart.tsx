"use client";

import { TYPE_LABELS, type CommitmentType } from "@/lib/constants";

// Presentation-only horizontal bar chart over already-computed `byType` counts.
// No charting library, no money math — it reads counts and draws CSS bars.
// Accessibility: every bar carries a visible label + value (never color-only),
// bars use a tokenized fill at full contrast, and the whole figure is summarised
// for screen readers. Width fill is guarded by prefers-reduced-motion in CSS.

type TypeRow = { type: string; count: number };

export function TypeBarChart({ data }: { data: TypeRow[] }) {
  if (data.length === 0) return null;

  // Already sorted desc by the analytics lib; guard anyway so the chart is
  // honest regardless of caller order.
  const rows = [...data].sort((a, b) => b.count - a.count);
  const max = rows[0]?.count ?? 0;

  const summary = rows
    .map(
      (r) =>
        `${TYPE_LABELS[r.type as CommitmentType] ?? r.type}: ${r.count} ${r.count === 1 ? "commitment" : "commitments"}`,
    )
    .join(", ");

  return (
    <figure
      className="m-0"
      role="img"
      aria-label={`Commitments by type. ${summary}.`}
    >
      <div className="surface mt-3 space-y-3.5 px-5 py-5">
        {rows.map((row, i) => {
          const label = TYPE_LABELS[row.type as CommitmentType] ?? row.type;
          const pct = max > 0 ? Math.max(6, Math.round((row.count / max) * 100)) : 0;

          return (
            <div
              key={row.type}
              className="animate-reveal"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[14px] font-medium text-foreground">
                  {label}
                </span>
                <span className="tnum shrink-0 text-[14px] font-semibold text-foreground">
                  {row.count}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary"
                aria-hidden
              >
                {/* Width transition is purely cosmetic; reduced-motion users
                    keep the final width with no animation (CSS media guard). */}
                <div
                  className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-[280ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
