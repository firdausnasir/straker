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

// Actionable urgencies (overdue / due soon) read as a filled tinted pill so the
// eye lands on them first; calm items (upcoming / later) get a quiet inset chip.
const URGENCY_PILL_CALM = "bg-muted text-muted-foreground";
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
  const pill = URGENCY_PILL[urgency] ?? URGENCY_PILL_CALM;
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
    // Filled, softly-elevated commitment card. The trigger lifts to the raised
    // shadow while expanded; a leading cobalt-tinted type chip anchors each row.
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
          "block w-full rounded-2xl px-4 py-4 text-left transition-colors",
          "hover:bg-muted/40 aria-expanded:bg-muted/30",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        {/* row 1 — type chip + name (wraps freely) + the hero mono amount */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
          >
            <TypeIcon className="size-[18px]" strokeWidth={2} />
          </span>
          <h3 className="mt-0.5 min-w-0 flex-1 text-pretty break-words text-[15px] font-semibold leading-snug text-foreground">
            {commitment.name}
          </h3>
          <span className="font-num shrink-0 text-right text-[18px] leading-tight text-foreground">
            {formatMoney(commitment.amountMinor, commitment.currency)}
          </span>
        </div>

        {/* row 2 — meta: due status pill (left) · cycle + renewal + chevron */}
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium",
              pill,
            )}
          >
            <span className="tnum">{dueLabel(due)}</span>
            <span className="opacity-70"> · {formatDueDate(due)}</span>
          </span>

          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <span>
              {CYCLE_LABELS[commitment.cycle]}
              <span className="mx-1.5 opacity-40">·</span>
              <span className={cn("font-medium", isAuto ? "text-primary" : "text-foreground/70")}>
                {isAuto ? "Auto" : "Manual"}
              </span>
            </span>
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
                open && "rotate-90",
              )}
            />
          </span>
        </div>

        {/* row 3 — linked card (only when set). Own muted line so row 2's
            due/cycle truncation is untouched at narrow width. */}
        {commitment.card && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <CreditCard aria-hidden className="size-3 shrink-0 opacity-70" />
            <span className="truncate">
              {commitment.card.accountName}
              <span className="tnum opacity-70">
                {commitment.card.last4
                  ? ` ·${commitment.card.last4}`
                  : ` · ${commitment.card.label}`}
              </span>
            </span>
          </div>
        )}
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
