"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpDown, WalletCards } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortMode = "due" | "amount" | "name";

// Sentinel filter values that aren't real account IDs. "all" shows everything;
// "unassigned" matches commitments with no linked card.
const ACCOUNT_ALL = "all";
const ACCOUNT_UNASSIGNED = "unassigned";

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
  const [account, setAccount] = useState<string>(ACCOUNT_ALL);

  // Distinct accounts present across the linked cards, ordered by name. Drives
  // the filter pills; an empty list hides the control entirely.
  const accounts = useMemo(() => {
    const byId = new Map<string, string>();

    for (const c of commitments) {
      if (c.card) {
        byId.set(c.card.accountId, c.card.accountName);
      }
    }

    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [commitments]);

  // Presentation-only account filter applied before sorting. "all" passes
  // everything; "unassigned" keeps card-less commitments; otherwise match the
  // selected account id.
  const filtered = useMemo(() => {
    if (account === ACCOUNT_ALL) {
      return commitments;
    }
    if (account === ACCOUNT_UNASSIGNED) {
      return commitments.filter((c) => c.card == null);
    }

    return commitments.filter((c) => c.card?.accountId === account);
  }, [commitments, account]);

  const sorted = useMemo(() => {
    const copy = [...filtered];

    if (sort === "due") {
      return copy.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    }
    if (sort === "amount") {
      // Compare within currency-agnostic minor units; highest first.
      return copy.sort((a, b) => b.amountMinor - a.amountMinor);
    }

    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, sort]);

  const count = sorted.length;

  return (
    // Shell offset: mobile clears the 56px top nav bar; desktop clears the
    // 240px left rail. Bottom padding keeps the last ruled row clear of the
    // viewport edge.
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* In-flow statement header. Title (display face) on the left, the
            primary actions kept inline on the right so they sit within the
            content column on every breakpoint — no fixed overlay colliding
            with the mobile top bar. */}
        <header className="animate-reveal flex items-end justify-between gap-4 pt-7 pb-5">
          <div className="min-w-0">
            <h1 className="font-display text-balance text-[2rem] leading-none text-foreground">
              Subscriptions
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground tnum">
              {count} active · sorted by {SORT_LABEL[sort].toLowerCase()}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Sort"
                className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
              >
                <ArrowUpDown className="size-[18px]" strokeWidth={2} />
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
              className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--wine-soft)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
            >
              <Plus className="size-[18px]" strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {/* Account filter — only shown once at least one commitment is linked to
            an account, so it stays out of the way for users who don't use cards. */}
        {accounts.length > 0 && (
          <div className="-mx-4 mb-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            <div className="flex w-max gap-2 pb-1">
              <FilterPill
                label="All accounts"
                active={account === ACCOUNT_ALL}
                onClick={() => setAccount(ACCOUNT_ALL)}
              />
              {accounts.map((a) => (
                <FilterPill
                  key={a.id}
                  label={a.name}
                  active={account === a.id}
                  onClick={() => setAccount(a.id)}
                />
              ))}
              <FilterPill
                label="Unassigned"
                active={account === ACCOUNT_UNASSIGNED}
                onClick={() => setAccount(ACCOUNT_UNASSIGNED)}
              />
            </div>
          </div>
        )}

        {commitments.length === 0 ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : count > 0 ? (
          // Card-per-item list — each commitment is its own filled, elevated
          // card with breathing room between them (modern-fintech stack), not a
          // hairline-ruled ledger. Reveal staggers down the list on mount.
          <ul className="mt-2 space-y-3">
            {sorted.map((c, i) => (
              <li
                key={c.id}
                className="animate-reveal"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CommitmentCard commitment={c} />
              </li>
            ))}
          </ul>
        ) : (
          // Commitments exist but the active account filter matches none — a
          // distinct state from the genuine zero-commitments empty state.
          <div className="surface mt-2 px-6 py-14 text-center">
            <p className="font-display text-lg text-foreground">
              Nothing in this account
            </p>
            <p className="mx-auto mt-2 max-w-xs text-pretty text-[13px] leading-relaxed text-muted-foreground">
              No commitments are linked here. Pick another account above to see
              the rest.
            </p>
          </div>
        )}
      </div>

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

// Single account-filter chip. ≥44px tap target (min-h-11). Active = filled
// cobalt with a soft lift; resting = filled card surface with the resting
// elevation, matching the new card system.
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-medium",
        "whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
          : "border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="surface mt-2 px-6 py-16 text-center">
      <span
        aria-hidden
        className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
      >
        <WalletCards className="size-7" strokeWidth={1.75} />
      </span>
      <p className="font-display text-balance text-2xl text-foreground">
        A clean ledger
      </p>
      <p className="mx-auto mt-3 max-w-xs text-pretty text-[14px] leading-relaxed text-muted-foreground">
        Add your first commitment — a streaming plan, the rent, a car loan — and
        it&apos;ll appear here, ordered by what&apos;s due next.
      </p>
      <Button
        size="lg"
        onClick={onAdd}
        className="mx-auto mt-7 rounded-lg active:scale-[0.96]"
      >
        <Plus data-icon="inline-start" strokeWidth={2.4} />
        Add a commitment
      </Button>
    </div>
  );
}
