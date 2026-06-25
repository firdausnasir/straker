import type { Cycle, Currency } from "./constants";
import type { CommitmentDTO } from "./types";

// Factor to normalise one cycle's amount to a per-month estimate, expressed as
// an integer ratio so money math stays in integer minor units (no float).
// Weekly uses 52/12 (avg weeks per month); the result is an estimate, labelled
// "≈" in the UI. Currencies are never mixed — there is no FX.
const PER_MONTH: Record<Cycle, { num: number; den: number }> = {
  weekly: { num: 52, den: 12 },
  monthly: { num: 1, den: 1 },
  quarterly: { num: 1, den: 3 },
  yearly: { num: 1, den: 12 },
};

function toPerMonthMinor(amountMinor: number, cycle: Cycle): number {
  const { num, den } = PER_MONTH[cycle];

  return Math.round((amountMinor * num) / den);
}

export type CurrencyTotal = {
  currency: Currency;
  perMonthMinor: number;
  perYearMinor: number;
  count: number;
};

// Per-account breakdown. Each account holds its own per-currency totals —
// currencies are never mixed within an account (no FX). Null-card commitments
// fall into a synthetic "Unassigned" group keyed by UNASSIGNED_ACCOUNT_ID.
export type AccountTotal = {
  accountId: string;
  accountName: string;
  byCurrency: CurrencyTotal[];
  count: number;
};

export const UNASSIGNED_ACCOUNT_ID = "__unassigned__";
const UNASSIGNED_ACCOUNT_NAME = "Unassigned";

export type Analytics = {
  total: number;
  byCurrency: CurrencyTotal[];
  byType: { type: string; count: number }[];
  byAccount: AccountTotal[];
};

// Accumulate one commitment's monthly-normalized amount into a per-currency
// map, mirroring the byCurrency logic exactly so the two never diverge.
function accumulateCurrency(
  map: Map<Currency, CurrencyTotal>,
  currency: Currency,
  perMonthMinor: number,
): void {
  const existing = map.get(currency);
  if (existing) {
    existing.perMonthMinor += perMonthMinor;
    existing.perYearMinor += perMonthMinor * 12;
    existing.count += 1;

    return;
  }

  map.set(currency, {
    currency,
    perMonthMinor,
    perYearMinor: perMonthMinor * 12,
    count: 1,
  });
}

type AccountAccumulator = {
  accountId: string;
  accountName: string;
  currencyMap: Map<Currency, CurrencyTotal>;
  count: number;
};

export function computeAnalytics(commitments: CommitmentDTO[]): Analytics {
  const currencyMap = new Map<Currency, CurrencyTotal>();
  const typeMap = new Map<string, number>();
  const accountMap = new Map<string, AccountAccumulator>();

  for (const c of commitments) {
    const perMonth = toPerMonthMinor(c.amountMinor, c.cycle);

    accumulateCurrency(currencyMap, c.currency, perMonth);

    typeMap.set(c.type, (typeMap.get(c.type) ?? 0) + 1);

    const accountId = c.card?.accountId ?? UNASSIGNED_ACCOUNT_ID;
    const accountName = c.card?.accountName ?? UNASSIGNED_ACCOUNT_NAME;

    let account = accountMap.get(accountId);
    if (!account) {
      account = { accountId, accountName, currencyMap: new Map(), count: 0 };
      accountMap.set(accountId, account);
    }
    accumulateCurrency(account.currencyMap, c.currency, perMonth);
    account.count += 1;
  }

  return {
    total: commitments.length,
    byCurrency: [...currencyMap.values()].sort((a, b) => b.perMonthMinor - a.perMonthMinor),
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byAccount: [...accountMap.values()]
      .map((a) => ({
        accountId: a.accountId,
        accountName: a.accountName,
        count: a.count,
        byCurrency: [...a.currencyMap.values()].sort(
          (x, y) => y.perMonthMinor - x.perMonthMinor,
        ),
      }))
      .sort((a, b) => b.count - a.count),
  };
}
