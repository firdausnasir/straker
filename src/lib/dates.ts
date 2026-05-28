// Presentation-side date helpers. Storage is UTC; display is MYT-friendly
// human text. Pure functions so they're safe in both server and client code.

export type Urgency = "overdue" | "soon" | "upcoming" | "later";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days from today (local) to the given date. Negative = in the past.
export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY);
}

export function urgencyOf(date: Date, now: Date = new Date()): Urgency {
  const days = daysUntil(date, now);

  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  if (days <= 14) return "upcoming";

  return "later";
}

// Tight, glanceable: "2 days late" / "Today" / "5 days" / "3 weeks". The card's
// urgency rail + color carry the "overdue vs upcoming" signal, so the label
// itself doesn't need to repeat "Due in".
export function dueLabel(date: Date, now: Date = new Date()): string {
  const days = daysUntil(date, now);

  if (days < 0) {
    const n = Math.abs(days);

    return `${n} day${n === 1 ? "" : "s"} late`;
  }

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `${days} days`;

  const weeks = Math.round(days / 7);

  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

// Year is omitted when it matches the current year — keeps the meta line short
// for everyday cases. Long-horizon items (loans crossing year boundaries) still
// show the year so they're unambiguous.
export function formatDueDate(date: Date, now: Date = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear();

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}
