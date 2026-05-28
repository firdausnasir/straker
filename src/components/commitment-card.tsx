"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { FastForward, Check, Trash2, Pencil } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { CYCLE_LABELS } from "@/lib/constants";
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

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "text-[var(--danger)]",
  soon: "text-[var(--warn)]",
  upcoming: "text-muted-foreground",
  later: "text-muted-foreground",
};

// Only the actionable states earn a colored ring + dot — calm items stay clean,
// so the eye lands on what's overdue or due soon first. The ring wraps the
// whole card so the urgency reads from any angle.
const URGENCY_ACCENT: Partial<Record<Urgency, string>> = {
  overdue: "var(--danger)",
  soon: "var(--warn)",
};

export function CommitmentCard({ commitment }: { commitment: CommitmentDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const due = new Date(commitment.nextDueDate);
  const urgency = urgencyOf(due);
  const accent = URGENCY_ACCENT[urgency];
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
    <div
      className="surface relative overflow-hidden"
      // Inset ring sits inside the rounded border-box and stacks above the soft
      // shadow — gives the whole card a colored outline without affecting layout.
      style={
        accent
          ? { boxShadow: `inset 0 0 0 1.5px ${accent}, var(--shadow-soft)` }
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "block w-full px-4 py-3.5 text-left transition-colors",
          "hover:bg-secondary/60 aria-expanded:bg-secondary/60",
        )}
      >
        {/* row 1 — primary: name (wraps freely) + amount */}
        <div className="flex items-start gap-3">
          <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug text-foreground">
            {commitment.name}
          </h3>
          <span className="tnum shrink-0 text-right text-[15px] font-semibold leading-snug text-foreground">
            {formatMoney(commitment.amountMinor, commitment.currency)}
          </span>
        </div>

        {/* row 2 — meta: due (left, urgency-coded) · cycle + renewal (right) */}
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
          <span className={cn("flex min-w-0 items-center gap-1.5", URGENCY_TEXT[urgency])}>
            {accent && (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: accent }}
              />
            )}
            <span className="truncate">
              <span className="tnum font-medium">{dueLabel(due)}</span>
              <span className="text-muted-foreground"> · {formatDueDate(due)}</span>
            </span>
          </span>

          <span className="shrink-0 text-muted-foreground">
            {CYCLE_LABELS[commitment.cycle]}
            <span className="mx-1.5 opacity-50">·</span>
            <span className={cn("font-medium", isAuto ? "text-primary" : "text-foreground/70")}>
              {isAuto ? "Auto" : "Manual"}
            </span>
          </span>
        </div>
      </button>

      {/* grid-rows 0fr→1fr gives a smooth, interruptible height transition without JS */}
      <div
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-[var(--hairline)] px-4 py-4">
            {commitment.notes && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {commitment.notes}
              </p>
            )}
            {/* Icon-only action row: FastForward = advance auto-cycle, Check =
                mark a manual bill paid, Pencil = edit, Trash = remove. 44px
                squares hit the mobile tap target floor; aria-label + title
                carry meaning for screen readers and desktop hover. */}
            <div className="flex items-center justify-end gap-2">
              <Button
                size="icon"
                variant="secondary"
                disabled={busy}
                onClick={() => act("/renew", "POST", isAuto ? "Advanced to the next cycle" : "Marked paid")}
                aria-label={isAuto ? "Advance to next cycle" : "Mark paid"}
                title={isAuto ? "Advance to next cycle" : "Mark paid"}
                className="h-11 w-11 rounded-full"
              >
                {isAuto ? <FastForward className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="secondary"
                disabled={busy}
                onClick={() => setEditOpen(true)}
                aria-label="Edit commitment"
                title="Edit"
                className="h-11 w-11 rounded-full"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
                aria-label="Remove commitment"
                title="Remove"
                className="h-11 w-11 rounded-full text-[var(--danger)] hover:bg-[var(--danger-tint)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">Remove this commitment?</AlertDialogTitle>
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
