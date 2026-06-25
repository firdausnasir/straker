"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import type { CommitmentDTO } from "@/lib/types";
import {
  COMMITMENT_TYPES,
  CURRENCIES,
  CYCLE_LABELS,
  CYCLES,
  TYPE_LABELS,
  REMINDER_DEFAULT_LEAD_DAYS,
  REMINDER_LEAD_OPTIONS,
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

// Minor units back to the major-unit string the amount input expects.
// Exponent is fixed at 2 for both supported currencies (see money.ts).
function toAmountInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

// Human label for a reminder lead time. 0 = the due date itself.
function reminderLeadLabel(days: number): string {
  return days === 0 ? "On the due date" : `${days} day${days === 1 ? "" : "s"} before`;
}

// Shape returned by GET /api/accounts. Cards carry no PAN — label/last4/network only.
type PickerCard = { id: string; label: string; last4: string | null; network: string | null };
type PickerAccount = { id: string; name: string; type: string; cards: PickerCard[] };

// Sentinel for the "No card" option — Select can't hold a real null value, so we
// map this back to null when building the request body.
const NO_CARD = "__none__";

// Card display: "{label} ·{last4}" when a last4 is on file, else just the label.
function cardOptionLabel(card: PickerCard): string {
  return card.last4 ? `${card.label} ·${card.last4}` : card.label;
}

// Single form for both create and edit. Passing `commitment` switches it to
// edit mode (PATCH the existing row); omitting it creates a new one.
export function CommitmentDialog({
  commitment,
  onClose,
  onSaved,
}: {
  commitment?: CommitmentDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(commitment);

  const [name, setName] = useState(commitment?.name ?? "");
  const [type, setType] = useState<(typeof COMMITMENT_TYPES)[number]>(
    commitment?.type ?? "subscription",
  );
  const [amount, setAmount] = useState(
    commitment ? toAmountInput(commitment.amountMinor) : "",
  );
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(
    commitment?.currency ?? "MYR",
  );
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>(commitment?.cycle ?? "monthly");
  const [dueDate, setDueDate] = useState<Date>(() =>
    commitment ? new Date(commitment.nextDueDate) : new Date(),
  );
  const [autoRenew, setAutoRenew] = useState(commitment?.renewalMode === "AUTO");
  const [notes, setNotes] = useState(commitment?.notes ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(commitment?.reminderEnabled ?? false);
  const [reminderLeadDays, setReminderLeadDays] = useState(
    commitment?.reminderLeadDays ?? REMINDER_DEFAULT_LEAD_DAYS,
  );
  const [pending, setPending] = useState(false);

  // Optional account→card link. Pre-seed from the existing card in edit mode so
  // the picker reflects the current link before accounts have loaded.
  const [accounts, setAccounts] = useState<PickerAccount[]>([]);
  const [accountId, setAccountId] = useState<string>(commitment?.card?.accountId ?? "");
  const [cardId, setCardId] = useState<string>(commitment?.card?.id ?? NO_CARD);

  // Load the user's accounts once on mount so the picker has options. Failure is
  // non-fatal — the link is optional, so we leave the picker empty rather than
  // blocking the form.
  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts");

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as { accounts?: PickerAccount[] };

        if (active) {
          setAccounts(data.accounts ?? []);
        }
      } catch {
        // Optional feature — swallow and leave the picker empty.
      }
    }

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  // Cards available for the chosen account; empty until an account is picked.
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const cardsForAccount = selectedAccount?.cards ?? [];

  // Switching account invalidates the prior card choice — reset to "No card".
  // The Select hands back `string | null`; coalesce to "" (no account).
  function handleAccountChange(value: string | null) {
    setAccountId(value ?? "");
    setCardId(NO_CARD);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);

    try {
      const res = await fetch(
        isEdit ? `/api/commitments/${commitment!.id}` : "/api/commitments",
        {
          method: isEdit ? "PATCH" : "POST",
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
            reminderEnabled,
            reminderLeadDays,
            // NO_CARD sentinel → null clears the link; otherwise send the card id.
            cardId: cardId === NO_CARD ? null : cardId,
          }),
        },
      );

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

      toast.success(isEdit ? `${name} updated` : `${name} added to your ledger`);
      onSaved();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle className="font-display text-xl">
            {isEdit ? "Edit commitment" : "Add a commitment"}
          </DialogTitle>
          <DialogDescription>Tracked in its own currency — no conversion.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pt-5 pb-6">
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
                  <SelectValue>{(v) => TYPE_LABELS[v as keyof typeof TYPE_LABELS]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
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
                  <SelectValue>{(v) => CYCLE_LABELS[v as keyof typeof CYCLE_LABELS]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
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
                <SelectContent>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Account <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose…">
                    {(value) =>
                      value ? accounts.find((a) => a.id === value)?.name ?? "Choose…" : "Choose…"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Card</Label>
              <Select value={cardId} onValueChange={(v) => setCardId(v ?? NO_CARD)} disabled={!accountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose…">
                    {(value) => {
                      const card = cardsForAccount.find((c) => c.id === value);

                      return card ? cardOptionLabel(card) : "No card";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CARD}>No card</SelectItem>
                  {cardsForAccount.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {cardOptionLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3.5">
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

          <div className="rounded-xl border border-border bg-secondary px-4 py-3.5">
            <label className="flex cursor-pointer items-center justify-between">
              <span>
                <span className="block text-sm font-semibold text-foreground">Remind me</span>
                <span className="block text-xs text-muted-foreground">
                  Push a reminder before it&apos;s due
                </span>
              </span>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                aria-label="Remind me before it's due"
              />
            </label>

            {reminderEnabled && (
              <div className="mt-4 border-t border-border pt-4">
                <Select
                  value={String(reminderLeadDays)}
                  onValueChange={(v) => setReminderLeadDays(Number(v))}
                >
                  <SelectTrigger id="lead" aria-label="When to remind me" className="w-full">
                    <SelectValue>{(value) => reminderLeadLabel(Number(value))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_LEAD_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {reminderLeadLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              disabled={pending}
              className="h-12 flex-[1.4] rounded-lg text-[15px] active:scale-[0.96]"
            >
              {pending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
