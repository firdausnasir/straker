// Domain vocabulary for commitments. SQLite has no native enums, so these
// const tuples are the single source of truth, reused by zod and the UI.

export const COMMITMENT_TYPES = ["subscription", "recurring", "loan", "other"] as const;
export type CommitmentType = (typeof COMMITMENT_TYPES)[number];

export const CYCLES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type Cycle = (typeof CYCLES)[number];

export const RENEWAL_MODES = ["AUTO", "MANUAL"] as const;
export type RenewalMode = (typeof RENEWAL_MODES)[number];

// ISO-4217 codes. No FX — each amount is exact in its own currency.
export const CURRENCIES = ["MYR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const TYPE_LABELS: Record<CommitmentType, string> = {
  subscription: "Subscription",
  recurring: "Recurring",
  loan: "Loan",
  other: "Other",
};

export const CYCLE_LABELS: Record<Cycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};
