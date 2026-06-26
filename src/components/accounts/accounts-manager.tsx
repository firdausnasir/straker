"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Wallet, Plus, Pencil, Trash2, Star, StarOff } from "lucide-react";
import type { PaymentAccountDTO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AccountDialog } from "./account-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

// Tracks which dialog is open. Discriminated so each carries only its own data.
// Set/unset-default need no dialog — they're an optimistic fetch + refresh.
type DialogState =
  | { kind: "add" }
  | { kind: "edit"; account: PaymentAccountDTO }
  | { kind: "delete"; account: PaymentAccountDTO }
  | null;

export function AccountsManager({
  initialAccounts,
  defaultAccountId,
}: {
  initialAccounts: PaymentAccountDTO[];
  defaultAccountId: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  // Guards the default toggle so a double-tap can't fire two requests at once.
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);

  function closeDialog() {
    setDialog(null);
  }

  // A successful mutation refreshes the server component (re-fetches accounts +
  // defaultAccountId); the dialog closes either way.
  function handleSaved() {
    closeDialog();
    router.refresh();
  }

  // Set/unset the default account. POST claims it, DELETE clears it. On success
  // we refresh so the server resends the authoritative defaultAccountId; 401
  // means the session is gone, so sign out like the rest of the app does.
  async function toggleDefault(id: string, makeDefault: boolean) {
    if (pendingDefaultId) {
      return;
    }
    setPendingDefaultId(id);

    try {
      const res = await fetch(`/api/accounts/${id}/default`, {
        method: makeDefault ? "POST" : "DELETE",
      });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        toast.error("Could not update the default. Try again.");

        return;
      }

      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPendingDefaultId(null);
    }
  }

  // Account delete. Surfaces 401 as a sign-out, toasts any other failure, and
  // on success refreshes + reports a message.
  async function runDelete(account: PaymentAccountDTO) {
    try {
      const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not delete. Try again.");

        return;
      }

      toast.success(`${account.name} deleted`);
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
            Add something you pay from — a bank, a card, an e-wallet, or cash.
          </p>
          <Button
            size="lg"
            onClick={() => setDialog({ kind: "add" })}
            className="mx-auto mt-7 rounded-lg active:scale-[0.96]"
          >
            <Plus data-icon="inline-start" strokeWidth={2.4} />
            Add an account
          </Button>
        </div>
      ) : (
        <>
          {initialAccounts.map((account, i) => {
            const isDefault = account.id === defaultAccountId;
            const busy = pendingDefaultId === account.id;

            return (
              <div
                key={account.id}
                className="surface animate-reveal flex min-h-[64px] items-center gap-3.5 px-4 py-3 transition-shadow duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:px-5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* One generic icon for every row — keeps the flat list calm. */}
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="size-5" strokeWidth={2} />
                </span>

                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-[15px] font-semibold text-foreground">
                    {account.name}
                  </span>
                  {account.last4 && (
                    <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[12px] text-muted-foreground tnum">
                      ·{account.last4}
                    </span>
                  )}
                  {isDefault && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Default
                    </span>
                  )}
                </span>

                {/* Actions cluster — set/unset-default, edit, delete. Each is a
                    44px hit target per the mobile-first tap-size rule. */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {isDefault ? (
                    <button
                      type="button"
                      aria-label={`Remove ${account.name} as default`}
                      disabled={busy}
                      onClick={() => toggleDefault(account.id, false)}
                      className="grid size-11 place-items-center rounded-lg text-primary transition-colors hover:bg-muted disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                    >
                      <StarOff className="size-[18px]" strokeWidth={2} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Set ${account.name} as default`}
                      disabled={busy}
                      onClick={() => toggleDefault(account.id, true)}
                      className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                    >
                      <Star className="size-[18px]" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Edit ${account.name}`}
                    onClick={() => setDialog({ kind: "edit", account })}
                    className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${account.name}`}
                    onClick={() => setDialog({ kind: "delete", account })}
                    className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <Button
            onClick={() => setDialog({ kind: "add" })}
            variant="secondary"
            className="h-12 w-full justify-center gap-2 rounded-lg text-[14px] font-semibold active:scale-[0.96]"
          >
            <Plus className="size-4" />
            Add an account
          </Button>
        </>
      )}

      {dialog?.kind === "add" && (
        <AccountDialog onClose={closeDialog} onSaved={handleSaved} />
      )}
      {dialog?.kind === "edit" && (
        <AccountDialog account={dialog.account} onClose={closeDialog} onSaved={handleSaved} />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDeleteDialog
          title={`Delete ${dialog.account.name}?`}
          description="Any commitments paid from it stay, just unlinked."
          confirmLabel="Delete account"
          onConfirm={() => runDelete(dialog.account)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
