"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import type { PaymentAccountDTO } from "@/lib/types";
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

// Create + edit share this form. Passing `account` switches it to edit (PATCH
// the existing row); omitting it creates a new account.
export function AccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account?: PaymentAccountDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [last4, setLast4] = useState(account?.last4 ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    const trimmedLast4 = last4.trim();

    try {
      const res = await fetch(isEdit ? `/api/accounts/${account!.id}` : "/api/accounts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        // last4 is optional; send null rather than an empty string so the
        // validator treats it as "no digits given" instead of an invalid value.
        body: JSON.stringify({ name, last4: trimmedLast4 === "" ? null : trimmedLast4 }),
      });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save. Check the fields and try again.");

        return;
      }

      toast.success(isEdit ? `${name} updated` : `${name} added`);
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
            {isEdit ? "Edit account" : "Add an account"}
          </DialogTitle>
          <DialogDescription>A bank, card, e-wallet, or cash you pay from.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Name</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                maxLength={60}
                placeholder="Maybank, Amex Platinum, GrabPay…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-last4">
                Last 4 <span className="font-normal text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                id="account-last4"
                value={last4}
                // Strip non-digits and cap at 4 so the field can never hold an
                // invalid last4 — parse at the boundary, keep state trusted.
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
              disabled={pending || name.trim().length === 0}
              className="h-12 flex-[1.4] rounded-lg text-[15px] active:scale-[0.96]"
            >
              {pending ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
