import type { Currency } from "./constants";

// Money is integer minor units (sen/cents). NEVER float for storage or math.
// MYR and USD both have 2 decimal places (ISO-4217 minor unit exponent = 2).
const MINOR_UNIT_EXPONENT = 2;
const MINOR_PER_MAJOR = 10 ** MINOR_UNIT_EXPONENT; // 100

const LOCALE: Record<Currency, string> = {
  MYR: "ms-MY",
  USD: "en-US",
};

// Parse a user-entered major-unit string ("19.90") into integer minor units.
// Rounds to the nearest minor unit. Throws on non-numeric input so the
// boundary (validation/API) fails loudly rather than storing garbage.
export function toMinorUnits(majorAmount: string | number): number {
  const value = typeof majorAmount === "number" ? majorAmount : Number(majorAmount.trim());

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid money amount: ${majorAmount}`);
  }

  return Math.round(value * MINOR_PER_MAJOR);
}

// Format integer minor units as a localized currency string, e.g. "RM19.90".
export function formatMoney(amountMinor: number, currency: Currency): string {
  const major = amountMinor / MINOR_PER_MAJOR;

  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
  }).format(major);
}
