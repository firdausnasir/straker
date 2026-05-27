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

export type Analytics = {
  total: number;
  byCurrency: CurrencyTotal[];
  byType: { type: string; count: number }[];
};

export function computeAnalytics(commitments: CommitmentDTO[]): Analytics {
  const currencyMap = new Map<Currency, CurrencyTotal>();
  const typeMap = new Map<string, number>();

  for (const c of commitments) {
    const perMonth = toPerMonthMinor(c.amountMinor, c.cycle);

    const existing = currencyMap.get(c.currency);
    if (existing) {
      existing.perMonthMinor += perMonth;
      existing.perYearMinor += perMonth * 12;
      existing.count += 1;
    } else {
      currencyMap.set(c.currency, {
        currency: c.currency,
        perMonthMinor: perMonth,
        perYearMinor: perMonth * 12,
        count: 1,
      });
    }

    typeMap.set(c.type, (typeMap.get(c.type) ?? 0) + 1);
  }

  return {
    total: commitments.length,
    byCurrency: [...currencyMap.values()].sort((a, b) => b.perMonthMinor - a.perMonthMinor),
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}
