"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import {
  COMMITMENT_TYPES,
  CURRENCIES,
  CYCLE_LABELS,
  CYCLES,
  TYPE_LABELS,
} from "@/lib/constants";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "./date-picker";

// Local-date yyyy-mm-dd (the API coerces it to a Date; avoids UTC off-by-one).
function toDateInput(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function QuickAddDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof COMMITMENT_TYPES)[number]>("subscription");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("MYR");
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>("monthly");
  const [dueDate, setDueDate] = useState<Date>(() => new Date());
  const [autoRenew, setAutoRenew] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          amount,
          currency,
          cycle,
          nextDueDate: toDateInput(dueDate),
          renewalMode: autoRenew ? "AUTO" : "MANUAL",
          notes,
        }),
      });

      if (res.status === 401) {
        // Session no longer valid — clear it and re-authenticate.
        void signOut({ redirectTo: "/login" });

        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save. Check the fields and try again.");

        return;
      }

      toast.success(`${name} added to your ledger`);
      onCreated();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong max-h-[90dvh] gap-0 overflow-y-auto rounded-[var(--radius-2xl)] border-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle className="text-xl font-bold tracking-tight">Add a commitment</DialogTitle>
          <DialogDescription>Tracked in its own currency — no conversion.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Netflix, car loan, gym…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong">
                  {COMMITMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as typeof cycle)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong">
                  {CYCLES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CYCLE_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                inputMode="decimal"
                placeholder="19.90"
                className="tnum"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-strong">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due">Next due date</Label>
            <DatePicker id="due" value={dueDate} onChange={setDueDate} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Card ending 4242, shared with a friend…"
              className="resize-none"
            />
          </div>

          <label className="glass flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-foreground">Auto-renew</span>
              <span className="block text-xs text-muted-foreground">
                {autoRenew
                  ? "Rolls to the next cycle on its own"
                  : "You advance it yourself when paid"}
              </span>
            </span>
            <Switch checked={autoRenew} onCheckedChange={setAutoRenew} aria-label="Auto-renew" />
          </label>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="h-12 flex-1 rounded-full" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="h-12 flex-[1.4] rounded-full text-[15px] shadow-[0_10px_30px_-10px_var(--brand)]"
            >
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
