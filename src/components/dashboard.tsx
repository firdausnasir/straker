"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUpDown,
  WalletCards,
  Search,
  X,
  ListFilter,
  ChevronDown,
} from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { COMMITMENT_TYPES, TYPE_LABELS, type CommitmentType } from "@/lib/constants";
import { urgencyOf } from "@/lib/dates";
import { CommitmentCard } from "./commitment-card";
import { CommitmentDialog } from "./commitment-dialog";
import { SummaryHeader } from "./summary-header";
import { TabBar } from "./tab-bar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SortMode = "due" | "amount" | "name";

// Sentinel account key for commitments with no linked card. Real account ids fill
// the rest of the multi-select set; an empty set means "all accounts".
const ACCOUNT_UNASSIGNED = "__unassigned__";

const SORT_LABEL: Record<SortMode, string> = {
  due: "Due date",
  amount: "Amount",
  name: "Name",
};

const SORT_ORDER: SortMode[] = ["due", "amount", "name"];

// Three visible urgency groups, in fixed display order. Collapses urgencyOf's
// soon (≤3d) + upcoming (≤14d) into one "Due soon" bucket; overdue and later
// map straight through. No new thresholds — see src/lib/dates.ts.
type GroupKey = "overdue" | "soon" | "later";
const GROUP_ORDER: GroupKey[] = ["overdue", "soon", "later"];
const GROUP_LABEL: Record<GroupKey, string> = {
  overdue: "Overdue",
  soon: "Due soon",
  later: "Later",
};

function groupKeyOf(date: Date): GroupKey {
  const u = urgencyOf(date);

  if (u === "overdue") return "overdue";
  if (u === "soon" || u === "upcoming") return "soon";

  return "later";
}

function sortComparator(mode: SortMode): (a: CommitmentDTO, b: CommitmentDTO) => number {
  if (mode === "amount") {
    // Highest first, within currency-agnostic minor units.
    return (a, b) => b.amountMinor - a.amountMinor;
  }
  if (mode === "name") {
    return (a, b) => a.name.localeCompare(b.name);
  }

  return (a, b) => a.nextDueDate.localeCompare(b.nextDueDate);
}

export function Dashboard({
  commitments,
  email,
}: {
  commitments: CommitmentDTO[];
  email?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<SortMode>("due");
  const [query, setQuery] = useState("");
  // Filters are collapsed by default — not used on every visit. The header
  // toggle reveals them; a badge keeps active filters visible while collapsed.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Multi-select facets. Empty array = no constraint (show all) for that facet.
  const [types, setTypes] = useState<CommitmentType[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  // Distinct accounts present across the linked cards, ordered by name. Drives
  // the account multi-select; an empty list hides that control entirely.
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

  function toggleType(t: CommitmentType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Presentation-only pipeline: search → type → account. Each facet is OR within
  // itself (any selected matches); facets are AND across each other. Runs on
  // trusted DTOs.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return commitments.filter((c) => {
      if (q) {
        const haystack = `${c.name} ${c.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (types.length > 0 && !types.includes(c.type)) return false;
      if (selectedAccounts.length > 0) {
        const key = c.card?.accountId ?? ACCOUNT_UNASSIGNED;
        if (!selectedAccounts.includes(key)) return false;
      }

      return true;
    });
  }, [commitments, query, types, selectedAccounts]);

  // Bucket the filtered list by urgency, then sort each bucket independently by
  // the active sort mode (sort is applied AFTER grouping).
  const groups = useMemo(() => {
    const buckets: Record<GroupKey, CommitmentDTO[]> = { overdue: [], soon: [], later: [] };

    for (const c of filtered) {
      buckets[groupKeyOf(new Date(c.nextDueDate))].push(c);
    }

    const cmp = sortComparator(sort);

    return GROUP_ORDER.map((key) => ({ key, items: [...buckets[key]].sort(cmp) })).filter(
      (g) => g.items.length > 0,
    );
  }, [filtered, sort]);

  const count = filtered.length;
  const searching = query.trim().length > 0;
  // Number of active facets, for the collapsed-state badge (max 3).
  const activeFilterCount =
    (searching ? 1 : 0) + (types.length > 0 ? 1 : 0) + (selectedAccounts.length > 0 ? 1 : 0);

  return (
    // Shell offset: mobile clears the 56px top nav bar; desktop clears the
    // 240px left rail. Bottom padding keeps the last row clear of the dock.
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <header className="animate-reveal flex items-end justify-between gap-4 pt-7 pb-3">
          <div className="min-w-0">
            <h1 className="font-display text-balance text-[2rem] leading-none text-foreground">
              Subscriptions
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground tnum">
              {count} active · sorted by {SORT_LABEL[sort].toLowerCase()}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {commitments.length > 0 && (
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                aria-label={
                  activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"
                }
                aria-expanded={filtersOpen}
                aria-controls="filter-panel"
                className={cn(
                  "relative grid size-11 place-items-center rounded-xl border text-foreground shadow-[var(--shadow-card)] transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                  filtersOpen
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <ListFilter className="size-[18px]" strokeWidth={2} />
                {activeFilterCount > 0 && (
                  <span className="tnum absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

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

        {commitments.length === 0 ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : (
          <>
            <SummaryHeader commitments={commitments} />

            {/* Collapsible controls — mounted only when open so the resting list
                stays compact. Search, then multi-select type chips, then the
                account multi-select. */}
            {filtersOpen && (
              <div id="filter-panel" className="animate-reveal mt-4 space-y-3">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name or notes…"
                    aria-label="Search commitments"
                    className="h-11 pl-11 pr-11"
                  />
                  {searching && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                    >
                      <X className="size-[18px]" />
                    </button>
                  )}
                </div>

                <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
                  <div className="flex w-max items-center gap-2 pb-1">
                    <FilterPill
                      label="All types"
                      active={types.length === 0}
                      onClick={() => setTypes([])}
                    />
                    {COMMITMENT_TYPES.map((t) => (
                      <FilterPill
                        key={t}
                        label={TYPE_LABELS[t]}
                        active={types.includes(t)}
                        onClick={() => toggleType(t)}
                      />
                    ))}

                    {accounts.length > 0 && (
                      <>
                        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label="Filter by account"
                            className={cn(
                              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium",
                              "whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                              selectedAccounts.length > 0
                                ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                                : "border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:bg-muted hover:text-foreground",
                            )}
                          >
                            Accounts
                            {selectedAccounts.length > 0 && (
                              <span className="tnum">({selectedAccounts.length})</span>
                            )}
                            <ChevronDown className="size-3.5 opacity-70" strokeWidth={2.4} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            {/* GroupLabel must live inside a Group (Base UI). */}
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Filter by account</DropdownMenuLabel>
                              {accounts.map((a) => (
                                <DropdownMenuCheckboxItem
                                  key={a.id}
                                  checked={selectedAccounts.includes(a.id)}
                                  onCheckedChange={() => toggleAccount(a.id)}
                                >
                                  {a.name}
                                </DropdownMenuCheckboxItem>
                              ))}
                              <DropdownMenuCheckboxItem
                                checked={selectedAccounts.includes(ACCOUNT_UNASSIGNED)}
                                onCheckedChange={() => toggleAccount(ACCOUNT_UNASSIGNED)}
                              >
                                Unassigned
                              </DropdownMenuCheckboxItem>
                            </DropdownMenuGroup>
                            {selectedAccounts.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSelectedAccounts([])}>
                                  Clear accounts
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {count > 0 ? (
              // Urgency-grouped sections. Each section: a header with its count,
              // then the compact rows. Empty buckets render nothing. Reveal stagger
              // resets per group so delays stay short on long lists.
              <div className="mt-5 space-y-7">
                {groups.map((group) => (
                  <section key={group.key}>
                    <div className="mb-2 flex items-baseline gap-2 px-1">
                      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {GROUP_LABEL[group.key]}
                      </h2>
                      <span className="tnum text-[12px] text-muted-foreground/70">
                        {group.items.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {group.items.map((c, i) => (
                        <li
                          key={c.id}
                          className="animate-reveal"
                          style={{ animationDelay: `${i * 45}ms` }}
                        >
                          <CommitmentCard commitment={c} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : searching ? (
              // Search yielded nothing — offer a one-tap way back.
              <div className="surface mt-5 px-6 py-14 text-center">
                <p className="font-display text-lg text-foreground">
                  No results for “{query.trim()}”
                </p>
                <p className="mx-auto mt-2 max-w-xs text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  Nothing matches that search in your names or notes.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setQuery("")}
                  className="mx-auto mt-6 rounded-lg active:scale-[0.96]"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              // Type/account filters matched none.
              <div className="surface mt-5 px-6 py-14 text-center">
                <p className="font-display text-lg text-foreground">
                  No matches for these filters
                </p>
                <p className="mx-auto mt-2 max-w-xs text-pretty text-[13px] leading-relaxed text-muted-foreground">
                  Nothing here fits the current type or account. Adjust the filters
                  above to see the rest.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <TabBar email={email} />

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

// Single filter chip. ≥44px tap target (min-h-11). Active = filled accent with a
// soft lift; resting = filled card surface with the resting elevation.
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
