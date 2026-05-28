"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpDown, Sparkles } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { CommitmentCard } from "./commitment-card";
import { CommitmentDialog } from "./commitment-dialog";
import { TabBar } from "./tab-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SortMode = "due" | "amount" | "name";

const SORT_LABEL: Record<SortMode, string> = {
  due: "Due date",
  amount: "Amount",
  name: "Name",
};

const SORT_ORDER: SortMode[] = ["due", "amount", "name"];

export function Dashboard({ commitments }: { commitments: CommitmentDTO[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<SortMode>("due");

  const sorted = useMemo(() => {
    const copy = [...commitments];

    if (sort === "due") {
      return copy.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    }
    if (sort === "amount") {
      // Compare within currency-agnostic minor units; highest first.
      return copy.sort((a, b) => b.amountMinor - a.amountMinor);
    }

    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }, [commitments, sort]);

  const count = commitments.length;

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-32 sm:px-6">
      {/* Fixed sort + add cluster — pinned to the top-right of the page
          container so the primary actions stay reachable while content scrolls.
          Mirrors the tab bar's positioning logic: outer wrapper centers a
          max-w-xl row, inner row right-aligns the pill so it lines up with
          the card edges below. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-4 sm:px-6">
        <div className="flex w-full max-w-xl justify-end">
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-card p-1"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Sort"
                className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary active:scale-95"
              >
                <ArrowUpDown className="h-[18px] w-[18px]" strokeWidth={2} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(v) => setSort(v as SortMode)}
                >
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  {SORT_ORDER.map((mode) => (
                    <DropdownMenuRadioItem key={mode} value={mode}>
                      {SORT_LABEL[mode]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setAdding(true)}
              aria-label="Add commitment"
              className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
              style={{ boxShadow: "var(--shadow-cta)" }}
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>

      {/* In-flow title block. Right-padded so the title doesn't collide with
          the fixed CTA cluster at the top of the page. */}
      <header className="animate-rise mb-3 pr-28 pt-6">
        <h1 className="font-display text-3xl text-foreground">All</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {count} active · by {SORT_LABEL[sort].toLowerCase()}
        </p>
      </header>

      {count > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {sorted.map((c, i) => (
            <li
              key={c.id}
              className="animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <CommitmentCard commitment={c} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState onAdd={() => setAdding(true)} />
      )}

      <TabBar />

      {adding && (
        <CommitmentDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="surface mt-8 px-6 py-16 text-center">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="mt-6 text-2xl font-semibold text-foreground">A clean slate.</p>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
        Add your first commitment — a streaming plan, the rent, a car loan —
        and it&apos;ll appear here, ordered by what&apos;s due next.
      </p>
      <button
        onClick={onAdd}
        className={cn(
          "mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3",
          "text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]",
        )}
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Add a commitment
      </button>
    </div>
  );
}
