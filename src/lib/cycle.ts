import type { Cycle } from "./constants";

// Advance a date by exactly one billing cycle. Uses UTC date math so a
// commitment due on the 31st rolls forward predictably (JS Date clamps
// overflowing months, e.g. Jan 31 + 1 month -> Mar 3, which is acceptable
// for billing reminders).
export function advanceByCycle(from: Date, cycle: Cycle): Date {
  const next = new Date(from);

  switch (cycle) {
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }

  return next;
}

// Roll a due date forward by whole cycles until it is in the future relative
// to `now`. Used by AUTO commitments so a date that lapsed while the app was
// idle catches up in one step instead of staying stuck in the past.
export function advanceToFuture(from: Date, cycle: Cycle, now: Date = new Date()): Date {
  let next = new Date(from);

  // Guard: a single advance must always move forward, so this terminates.
  while (next.getTime() <= now.getTime()) {
    next = advanceByCycle(next, cycle);
  }

  return next;
}
