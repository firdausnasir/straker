"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { computeAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { dueLabel, urgencyOf } from "@/lib/dates";
import { cn } from "@/lib/utils";

// At-a-glance anchor above the list: monthly outlook per currency + what's due
// next. Always fed the FULL unfiltered commitment list — it is a stable summary,
// not a reflection of the active search/filter. Renders nothing for an empty
// ledger (the dashboard owns that empty state).
export function SummaryHeader({ commitments }: { commitments: CommitmentDTO[] }) {
  const { byCurrency, next } = useMemo(() => {
    const { byCurrency } = computeAnalytics(commitments);

    // Soonest (or most overdue) commitment — the single item to focus on. Earliest
    // nextDueDate wins; ISO date strings sort lexically.
    const next = commitments.reduce<CommitmentDTO | null>((earliest, c) => {
      if (!earliest || c.nextDueDate < earliest.nextDueDate) {
        return c;
      }

      return earliest;
    }, null);

    return { byCurrency, next };
  }, [commitments]);

  if (commitments.length === 0) {
    return null;
  }

  const nextUrgency = next ? urgencyOf(new Date(next.nextDueDate)) : "later";

  return (
    <section
      aria-label="Monthly outlook"
      className="surface animate-reveal mt-2 px-5 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Per month
        </p>
        <p className="tnum text-[11px] text-muted-foreground">
          {commitments.length} active
        </p>
      </div>

      {/* One figure per currency — never summed across currencies (no FX). */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {byCurrency.map((row) => (
          <div key={row.currency} className="flex items-baseline gap-1.5">
            <span className="font-num text-[1.75rem] leading-none text-foreground">
              ≈ {formatMoney(row.perMonthMinor, row.currency)}
            </span>
            <span className="tnum text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {row.currency}
            </span>
          </div>
        ))}
      </div>

      {next && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[13px]">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Next up</span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {next.name}
          </span>
          <span
            className={cn(
              "tnum shrink-0 font-medium",
              nextUrgency === "overdue"
                ? "text-destructive"
                : nextUrgency === "soon"
                  ? "text-warn"
                  : "text-muted-foreground",
            )}
          >
            {dueLabel(new Date(next.nextDueDate))}
          </span>
        </div>
      )}
    </section>
  );
}
