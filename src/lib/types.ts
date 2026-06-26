import type { CommitmentType, Currency, Cycle, RenewalMode } from "./constants";

// Compact summary of the payment account a commitment is paid from, embedded in
// the commitment DTO so the dashboard filter + card meta render without extra
// fetches. Single flat layer — `name` is the only label (cards are gone).
export type CommitmentAccountDTO = {
  id: string;
  name: string;
  last4: string | null;
};

// Serializable shape passed from server components to client components.
// Dates are ISO strings; amount stays in integer minor units.
export type CommitmentDTO = {
  id: string;
  name: string;
  type: CommitmentType;
  amountMinor: number;
  currency: Currency;
  cycle: Cycle;
  nextDueDate: string;
  renewalMode: RenewalMode;
  notes: string | null;
  reminderEnabled: boolean;
  reminderLeadDays: number;
  accountId: string | null;
  account: CommitmentAccountDTO | null;
};

export type PaymentAccountDTO = {
  id: string;
  name: string;
  last4: string | null;
};
