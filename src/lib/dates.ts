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

// "Overdue by 2 days" / "Due today" / "Due in 5 days" / "Due in 3 weeks".
export function dueLabel(date: Date, now: Date = new Date()): string {
  const days = daysUntil(date, now);

  if (days < 0) {
    const n = Math.abs(days);

    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 14) return `Due in ${days} days`;

  const weeks = Math.round(days / 7);

  return `Due in ${weeks} week${weeks === 1 ? "" : "s"}`;
}

export function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
