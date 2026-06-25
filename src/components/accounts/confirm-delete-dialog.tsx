"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Generic destructive confirmation. The caller owns the async delete via
// `onConfirm`; this only gates it behind a confirm step and a busy state.
export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) {
      return;
    }
    setBusy(true);

    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl text-foreground">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="h-12 flex-1 rounded-lg active:scale-[0.96]"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 flex-1 rounded-lg text-[15px] font-semibold active:scale-[0.96]"
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? "Removing…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
