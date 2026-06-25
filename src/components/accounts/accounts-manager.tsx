"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import {
  Landmark,
  CreditCard,
  Wallet,
  Coins,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import {
  ACCOUNT_TYPE_LABELS,
  CARD_NETWORK_LABELS,
  type AccountType,
} from "@/lib/constants";
import type { CardDTO, PaymentAccountDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AccountDialog } from "./account-dialog";
import { CardDialog } from "./card-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

// Icon per account kind — keeps the list scannable at a glance.
const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  bank: Landmark,
  credit: CreditCard,
  ewallet: Wallet,
  cash: Coins,
};

// Tracks which dialog is open. Discriminated so each carries only its own data.
type DialogState =
  | { kind: "add-account" }
  | { kind: "edit-account"; account: PaymentAccountDTO }
  | { kind: "delete-account"; account: PaymentAccountDTO }
  | { kind: "add-card"; accountId: string }
  | { kind: "edit-card"; accountId: string; card: CardDTO }
  | { kind: "delete-card"; accountId: string; card: CardDTO; label: string }
  | null;

export function AccountsManager({
  initialAccounts,
}: {
  initialAccounts: PaymentAccountDTO[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    // Expand single accounts by default so cards aren't hidden on first visit.
    () => new Set(initialAccounts.length === 1 ? initialAccounts.map((a) => a.id) : []),
  );

  function closeDialog() {
    setDialog(null);
  }

  // A successful mutation refreshes the server component (re-fetches accounts);
  // the dialog closes either way.
  function handleSaved() {
    closeDialog();
    router.refresh();
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  // Shared DELETE caller for accounts + cards. Surfaces 401 as a sign-out and
  // toasts any other failure; on success it refreshes and reports a message.
  async function runDelete(url: string, successMsg: string) {
    try {
      const res = await fetch(url, { method: "DELETE" });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not delete. Try again.");

        return;
      }

      toast.success(successMsg);
      closeDialog();
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    }
  }

  return (
    <div className="mt-2 space-y-3">
      {initialAccounts.length === 0 ? (
        // Quiet, typeset empty state — display line, muted hint, primary CTA.
        <div className="surface animate-reveal px-6 py-16 text-center">
          <p className="font-display text-balance text-2xl text-foreground">
            No accounts yet
          </p>
          <p className="mx-auto mt-3 max-w-xs text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Add a bank, card, e-wallet, or cash to track where your money goes
            out from.
          </p>
          <Button
            size="lg"
            onClick={() => setDialog({ kind: "add-account" })}
            className="mx-auto mt-7 rounded-lg active:scale-[0.96]"
          >
            <Plus data-icon="inline-start" strokeWidth={2.4} />
            Add an account
          </Button>
        </div>
      ) : (
        <>
          {initialAccounts.map((account, i) => {
            const Icon = ACCOUNT_ICONS[account.type];
            const isOpen = expanded.has(account.id);

            return (
              <div
                key={account.id}
                className="surface animate-reveal overflow-hidden p-0 transition-shadow duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* Account header — tap to expand/collapse the card list. */}
                <button
                  type="button"
                  onClick={() => toggle(account.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-foreground">
                      {account.name}
                    </span>
                    <span className="block text-[13px] text-muted-foreground tnum">
                      {ACCOUNT_TYPE_LABELS[account.type]} ·{" "}
                      {account.cards.length} {account.cards.length === 1 ? "card" : "cards"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                      isOpen && "rotate-180",
                    )}
                    strokeWidth={2}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pt-4 pb-4 sm:px-5">
                    {account.cards.length === 0 ? (
                      <p className="rounded-xl bg-secondary px-4 py-3.5 text-[13px] text-muted-foreground">
                        No cards on this account yet.
                      </p>
                    ) : (
                      // Filled inset card rows — each its own softly-shaded
                      // tile with a leading credit-card icon chip.
                      <ul className="space-y-2">
                        {account.cards.map((card) => (
                          <li
                            key={card.id}
                            className="flex min-h-[56px] items-center gap-3 rounded-xl bg-secondary px-3 py-2 sm:px-3.5"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <CreditCard className="size-[18px]" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium text-foreground">
                                {card.label}
                              </span>
                              {(card.network || card.last4) && (
                                <span className="block text-[12px] text-muted-foreground">
                                  {card.network && CARD_NETWORK_LABELS[card.network]}
                                  {card.network && card.last4 && " "}
                                  {card.last4 && (
                                    <span className="tnum">·{card.last4}</span>
                                  )}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              aria-label={`Edit ${card.label}`}
                              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                              onClick={() =>
                                setDialog({ kind: "edit-card", accountId: account.id, card })
                              }
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${card.label}`}
                              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                              onClick={() =>
                                setDialog({
                                  kind: "delete-card",
                                  accountId: account.id,
                                  card,
                                  label: card.label,
                                })
                              }
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ kind: "add-card", accountId: account.id })}
                        className="h-11 justify-center gap-1.5 rounded-lg px-4 text-[13px] active:scale-[0.96]"
                      >
                        <Plus className="size-4" />
                        Add card
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ kind: "edit-account", account })}
                        className="h-11 justify-center gap-1.5 rounded-lg px-4 text-[13px] active:scale-[0.96]"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ kind: "delete-account", account })}
                        className="h-11 justify-center gap-1.5 rounded-lg px-4 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-[0.96]"
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <Button
            onClick={() => setDialog({ kind: "add-account" })}
            variant="secondary"
            className="h-12 w-full justify-center gap-2 rounded-lg text-[14px] font-semibold active:scale-[0.96]"
          >
            <Plus className="size-4" />
            Add an account
          </Button>
        </>
      )}

      {dialog?.kind === "add-account" && (
        <AccountDialog onClose={closeDialog} onSaved={handleSaved} />
      )}
      {dialog?.kind === "edit-account" && (
        <AccountDialog account={dialog.account} onClose={closeDialog} onSaved={handleSaved} />
      )}
      {dialog?.kind === "add-card" && (
        <CardDialog accountId={dialog.accountId} onClose={closeDialog} onSaved={handleSaved} />
      )}
      {dialog?.kind === "edit-card" && (
        <CardDialog
          accountId={dialog.accountId}
          card={dialog.card}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
      {dialog?.kind === "delete-account" && (
        <ConfirmDeleteDialog
          title={`Delete ${dialog.account.name}?`}
          description="Its cards are removed too. Any commitments paid from them stay, just unlinked."
          confirmLabel="Delete account"
          onConfirm={() =>
            runDelete(`/api/accounts/${dialog.account.id}`, `${dialog.account.name} deleted`)
          }
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "delete-card" && (
        <ConfirmDeleteDialog
          title={`Delete ${dialog.label}?`}
          description="Any commitments paid from this card stay, just unlinked."
          confirmLabel="Delete card"
          onConfirm={() =>
            runDelete(
              `/api/accounts/${dialog.accountId}/cards/${dialog.card.id}`,
              `${dialog.label} deleted`,
            )
          }
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
