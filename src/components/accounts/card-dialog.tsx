"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { CARD_NETWORKS, CARD_NETWORK_LABELS, type CardNetwork } from "@/lib/constants";
import type { CardDTO } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Sentinel for "no network" — Select needs a concrete value, so the absence of
// a network is modelled explicitly rather than as an empty string.
const NO_NETWORK = "none";

// Create + edit share this form. `accountId` names the parent account; passing
// `card` switches it to edit (PATCH the existing card).
export function CardDialog({
  accountId,
  card,
  onClose,
  onSaved,
}: {
  accountId: string;
  card?: CardDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(card);

  const [label, setLabel] = useState(card?.label ?? "");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [network, setNetwork] = useState<CardNetwork | typeof NO_NETWORK>(
    card?.network ?? NO_NETWORK,
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const trimmedLast4 = last4.trim();

    try {
      const res = await fetch(
        isEdit
          ? `/api/accounts/${accountId}/cards/${card!.id}`
          : `/api/accounts/${accountId}/cards`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            last4: trimmedLast4 === "" ? null : trimmedLast4,
            network: network === NO_NETWORK ? null : network,
          }),
        },
      );

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save. Check the fields and try again.");

        return;
      }

      toast.success(isEdit ? `${label} updated` : `${label} added`);
      onSaved();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-xl text-foreground">
            {isEdit ? "Edit card" : "Add a card"}
          </DialogTitle>
          <DialogDescription>
            Just a label and the last four digits — never the full number.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-label">Label</Label>
            <Input
              id="card-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              autoFocus
              maxLength={60}
              placeholder="Physical card, Virtual, Joint…"
            />
          </div>

          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label>Network</Label>
              <Select value={network} onValueChange={(v) => setNetwork(v as typeof network)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v) =>
                      v === NO_NETWORK
                        ? "No network"
                        : CARD_NETWORK_LABELS[v as CardNetwork]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_NETWORK}>No network</SelectItem>
                  {CARD_NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {CARD_NETWORK_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="card-last4">
                Last 4 <span className="font-normal text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                id="card-last4"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                placeholder="4242"
                className="tnum"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="h-12 flex-1 rounded-lg active:scale-[0.96]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || label.trim().length === 0}
              className="h-12 flex-[1.4] rounded-lg text-[15px] active:scale-[0.96]"
            >
              {pending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
