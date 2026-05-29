import type { CommitmentType, Currency, Cycle, RenewalMode } from "./constants";

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
};
