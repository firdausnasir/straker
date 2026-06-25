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

// Payment-account kinds. String enum (SQLite has no native enums), validated
// at the boundary by zod and reused by the /accounts UI.
export const ACCOUNT_TYPES = ["bank", "credit", "ewallet", "cash"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Card networks. Optional on a card — `other` covers anything unlisted. Never
// stores a PAN/CVV/expiry; the network is display metadata only.
export const CARD_NETWORKS = ["visa", "mastercard", "amex", "other"] as const;
export type CardNetwork = (typeof CARD_NETWORKS)[number];

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

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank account",
  credit: "Credit card",
  ewallet: "E-wallet",
  cash: "Cash",
};

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  other: "Other",
};

// Due-date reminders. Lead = how many days before nextDueDate to push;
// 0 means remind on the due date itself.
export const REMINDER_MIN_LEAD_DAYS = 0;
export const REMINDER_MAX_LEAD_DAYS = 7;
export const REMINDER_DEFAULT_LEAD_DAYS = 3;
// Lead-day options offered in the commitment dialog (within min/max).
export const REMINDER_LEAD_OPTIONS = [0, 1, 2, 3, 5, 7] as const;
