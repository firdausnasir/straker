"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { RotateCw, Trash2, Repeat, Hand } from "lucide-react";
import type { CommitmentDTO } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { CYCLE_LABELS, TYPE_LABELS, type CommitmentType } from "@/lib/constants";
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

// No brand logos, so each commitment gets a tinted monogram tile keyed to its
// type — consistent, recognisable, and on-brand with the glass look.
const TYPE_TILE: Record<CommitmentType, string> = {
  subscription: "from-[#0caa9b] to-[#16c6b3]",
  recurring: "from-[#6366f1] to-[#8b5cf6]",
  loan: "from-[#d98324] to-[#e6a23c]",
  other: "from-[#64748b] to-[#94a3b8]",
};

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "text-[var(--danger)]",
  soon: "text-[var(--warn)]",
  upcoming: "text-muted-foreground",
  later: "text-muted-foreground",
};

export function CommitmentCard({ commitment }: { commitment: CommitmentDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const due = new Date(commitment.nextDueDate);
  const urgency = urgencyOf(due);
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
    <div className="glass overflow-hidden rounded-[var(--radius-2xl)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-3.5 py-3.5 text-left transition-colors hover:bg-[var(--brand-tint)]"
      >
        {/* monogram tile */}
        <span
          aria-hidden
          className={cn(
            "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[22px] font-semibold text-white shadow-inner",
            TYPE_TILE[commitment.type],
          )}
          style={{ height: 52, width: 52 }}
        >
          {commitment.name.trim().charAt(0).toUpperCase() || "•"}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-semibold leading-tight text-foreground">
              {commitment.name}
            </span>
            <RenewalTag isAuto={isAuto} />
          </span>
          <span className={cn("mt-0.5 block truncate text-[13.5px]", URGENCY_TEXT[urgency])}>
            <span className="tnum">{dueLabel(due)}</span>
            <span className="text-muted-foreground"> · {formatDueDate(due)}</span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="tnum block text-[17px] font-semibold leading-tight text-foreground">
            {formatMoney(commitment.amountMinor, commitment.currency)}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {CYCLE_LABELS[commitment.cycle]}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-[var(--hairline)] px-3.5 py-3">
          {commitment.notes && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{commitment.notes}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="mr-auto text-[12.5px] font-medium text-muted-foreground">
              {TYPE_LABELS[commitment.type]}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => act("/renew", "POST", "Advanced to the next cycle")}
              className="h-10 gap-1.5 rounded-full px-4"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {isAuto ? "Advance" : "Mark paid"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              className="h-10 gap-1.5 rounded-full px-4 text-[var(--danger)] hover:bg-[var(--danger-tint)] hover:text-[var(--danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="glass-strong border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this commitment?</AlertDialogTitle>
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
    </div>
  );
}

// Always-visible chip so the renewal mode reads at a glance, collapsed or not.
function RenewalTag({ isAuto }: { isAuto: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        isAuto
          ? "bg-[var(--brand-tint)] text-primary"
          : "bg-[var(--secondary)] text-muted-foreground",
      )}
    >
      {isAuto ? <Repeat className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
      {isAuto ? "Auto" : "Manual"}
    </span>
  );
}
