"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import {
  FastForward,
  Check,
  Trash2,
  Pencil,
  CreditCard,
  ChevronRight,
  Repeat,
  Landmark,
  Wallet,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { CYCLE_LABELS, type CommitmentType } from "@/lib/constants";
import { dueLabel, formatDueDate, urgencyOf, type Urgency } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CommitmentDialog } from "./commitment-dialog";

// Actionable urgencies (overdue / due-soon) get a filled tinted pill on the due
// label so the eye lands on them first; calm items (upcoming / later) stay quiet
// plain text. The label text itself ("3 days late") carries meaning beyond color.
const URGENCY_PILL: Partial<Record<Urgency, string>> = {
  overdue: "bg-destructive/10 text-destructive",
  soon: "bg-warn-tint text-warn",
};

// Leading category chip — a lucide glyph keyed off the commitment type, so the
// eye can sort the list by kind at a glance. Cobalt-tinted to match the accent.
const TYPE_ICON: Record<CommitmentType, LucideIcon> = {
  subscription: Repeat,
  recurring: Receipt,
  loan: Landmark,
  other: Wallet,
};

export function CommitmentCard({ commitment }: { commitment: CommitmentDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const due = new Date(commitment.nextDueDate);
  const urgency = urgencyOf(due);
  const pill = URGENCY_PILL[urgency];
  const TypeIcon = TYPE_ICON[commitment.type];
  const isAuto = commitment.renewalMode === "AUTO";

  async function act(path: string, method: string, okMessage: string) {
    setBusy(true);

    try {
      const res = await fetch(`/api/commitments/${commitment.id}${path}`, { method });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        toast.error("Something went wrong. Try again.");

        return;
      }

      toast.success(okMessage);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // Compact, softly-elevated ledger row. A left urgency rail (overdue/soon)
    // draws the eye; the trigger lifts to the raised shadow while expanded.
    <div
      className={cn(
        "surface group/card overflow-hidden transition-shadow duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        open && "shadow-[var(--shadow-card-raised)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "block w-full rounded-2xl px-4 py-3 text-left transition-colors",
          "hover:bg-muted/40 aria-expanded:bg-muted/30",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          >
            <TypeIcon className="size-[17px]" strokeWidth={2} />
          </span>

          {/* Mobile: name on line 1, amount + due on line 2 (flex-col). At sm: it
              collapses to a single row with the meta pushed right. Amount and due
              never truncate — only the name ellipsizes. */}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="min-w-0 truncate text-[15px] font-semibold leading-snug text-foreground">
              {commitment.name}
            </span>
            <span className="flex shrink-0 items-center gap-2.5 text-[13px]">
              <span className="font-num text-[15px] leading-none text-foreground">
                {formatMoney(commitment.amountMinor, commitment.currency)}
              </span>
              {pill ? (
                <span
                  className={cn(
                    "tnum inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium leading-none",
                    pill,
                  )}
                >
                  {dueLabel(due)}
                </span>
              ) : (
                <span className="tnum text-[12px] font-medium leading-none text-muted-foreground">
                  {dueLabel(due)}
                </span>
              )}
            </span>
          </span>

          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
              open && "rotate-90",
            )}
          />
        </div>
      </button>

      {/* grid-rows 0fr→1fr gives a smooth, interruptible height transition without JS */}
      <div
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border px-4 pt-3 pb-4">
            {/* Detail line: full due date · cycle · renewal mode — moved here from
                the resting row to keep that row a single dense line. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
              <span className="tnum">Due {formatDueDate(due)}</span>
              <span className="opacity-40">·</span>
              <span>{CYCLE_LABELS[commitment.cycle]}</span>
              <span className="opacity-40">·</span>
              <span className={cn("font-medium", isAuto ? "text-primary" : "text-foreground/70")}>
                {isAuto ? "Auto-renews" : "Manual"}
              </span>
            </div>

            {commitment.account && (
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <CreditCard aria-hidden className="size-3 shrink-0 opacity-70" />
                <span className="truncate">
                  {commitment.account.name}
                  {commitment.account.last4 && (
                    <span className="tnum opacity-70"> ·{commitment.account.last4}</span>
                  )}
                </span>
              </div>
            )}

            {commitment.notes && (
              <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
                {commitment.notes}
              </p>
            )}

            {/* Icon-only action row: FastForward = advance auto-cycle, Check =
                mark a manual bill paid, Pencil = edit, Trash = remove. 44px
                squares hit the mobile tap target floor; aria-label + title
                carry meaning for screen readers and desktop hover. */}
            <div className="flex items-center justify-end gap-2">
              <Button
                size="icon-lg"
                variant="secondary"
                disabled={busy}
                onClick={() => act("/renew", "POST", isAuto ? "Advanced to the next cycle" : "Marked paid")}
                aria-label={isAuto ? "Advance to next cycle" : "Mark paid"}
                title={isAuto ? "Advance to next cycle" : "Mark paid"}
                className="rounded-lg active:scale-[0.96]"
              >
                {isAuto ? <FastForward /> : <Check />}
              </Button>
              <Button
                size="icon-lg"
                variant="secondary"
                disabled={busy}
                onClick={() => setEditOpen(true)}
                aria-label="Edit commitment"
                title="Edit"
                className="rounded-lg active:scale-[0.96]"
              >
                <Pencil />
              </Button>
              <Button
                size="icon-lg"
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
                aria-label="Remove commitment"
                title="Remove"
                className="rounded-lg active:scale-[0.96]"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg">Remove this commitment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{commitment.name}” will be deleted from your ledger. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                act("", "DELETE", "Removed from your ledger");
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editOpen && (
        <CommitmentDialog
          commitment={commitment}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
