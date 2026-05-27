"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpDown, Sun, Moon, Sparkles } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { CommitmentCard } from "./commitment-card";
import { QuickAddDialog } from "./quick-add-dialog";
import { TabBar } from "./tab-bar";
import { useTheme } from "./theme";
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
  const { resolved, toggle } = useTheme();
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
      {/* sticky top bar — theme · title · add/sort pill */}
      <header className="animate-rise sticky top-0 z-20 flex items-center justify-between gap-3 py-4">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="glass grid h-11 w-11 place-items-center rounded-full text-foreground transition-transform active:scale-95"
        >
          {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="text-center">
          <h1 className="text-[19px] font-bold tracking-tight text-foreground">All</h1>
          <p className="text-[11px] font-medium text-muted-foreground">
            {count} active · by {SORT_LABEL[sort].toLowerCase()}
          </p>
        </div>

        <div className="glass flex items-center gap-1 rounded-full p-1">
          <button
            onClick={() => setAdding(true)}
            aria-label="Add commitment"
            className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-colors hover:bg-[var(--brand-tint)] active:scale-95"
          >
            <Plus className="h-[19px] w-[19px]" strokeWidth={2.4} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Sort"
              className="grid h-11 w-11 place-items-center rounded-full text-foreground transition-colors hover:bg-[var(--brand-tint)] active:scale-95"
            >
              <ArrowUpDown className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong w-44">
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
        </div>
      </header>

      {count > 0 ? (
        <ul className="mt-1 space-y-2.5">
          {sorted.map((c, i) => (
            <li key={c.id} className="animate-rise" style={{ animationDelay: `${i * 45}ms` }}>
              <CommitmentCard commitment={c} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState onAdd={() => setAdding(true)} />
      )}

      <TabBar />

      {adding && (
        <QuickAddDialog
          onClose={() => setAdding(false)}
          onCreated={() => {
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
    <div className="glass mt-6 rounded-[var(--radius-2xl)] px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#0caa9b] to-[#16c6b3] text-white shadow-lg">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="mt-5 text-xl font-bold text-foreground">A clean slate.</p>
      <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
        Add your first commitment — a streaming plan, the rent, a car loan — and
        it&apos;ll appear here, ordered by what&apos;s due next.
      </p>
      <button
        onClick={onAdd}
        className={cn(
          "mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5",
          "text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_var(--brand)]",
          "transition-transform active:scale-[0.98]",
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Add a commitment
      </button>
    </div>
  );
}
