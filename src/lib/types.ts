import type {
  AccountType,
  CardNetwork,
  CommitmentType,
  Currency,
  Cycle,
  RenewalMode,
} from "./constants";

// Compact summary of the card a commitment is paid from, embedded in the
// commitment DTO so the card UI + dashboard filter render without extra fetches.
// `accountName` is denormalized for display (the account is the card's parent).
export type CommitmentCardDTO = {
  id: string;
  label: string;
  last4: string | null;
  network: CardNetwork | null;
  accountId: string;
  accountName: string;
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
  cardId: string | null;
  card: CommitmentCardDTO | null;
};

export type CardDTO = {
  id: string;
  label: string;
  last4: string | null;
  network: CardNetwork | null;
};

export type PaymentAccountDTO = {
  id: string;
  name: string;
  type: AccountType;
  cards: CardDTO[];
};
