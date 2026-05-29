import "server-only";
import type { Commitment, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { advanceToFuture } from "./cycle";
import type { Cycle } from "./constants";
import { REMINDER_MAX_LEAD_DAYS } from "./constants";

// Roll every lapsed AUTO commitment forward to its next future due date, across
// all users. Run by the daily cron (before the reminder scan) — NOT on read, so
// dashboard/analytics stay a single query. MANUAL commitments are left untouched;
// the user advances those explicitly via the renew action.
//
// Trade-off: AUTO due dates only advance when the cron fires. With no cron
// running they stay frozen in the past — see CLAUDE.md (PWA + Web Push).
export async function advanceLapsedAutoCommitments(now: Date): Promise<number> {
  const lapsed = await prisma.commitment.findMany({
    where: {
      isActive: true,
      renewalMode: "AUTO",
      nextDueDate: { lte: now },
    },
  });

  if (lapsed.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    lapsed.map((c) =>
      prisma.commitment.update({
        where: { id: c.id },
        data: { nextDueDate: advanceToFuture(c.nextDueDate, c.cycle as Cycle, now) },
      }),
    ),
  );

  return lapsed.length;
}

// Active commitments for a user, sorted by soonest due date first. Pure read —
// AUTO advancement happens in the cron (advanceLapsedAutoCommitments).
export async function getActiveCommitments(userId: string): Promise<Commitment[]> {
  return prisma.commitment.findMany({
    where: { userId, isActive: true },
    orderBy: { nextDueDate: "asc" },
  });
}

export type CommitmentWithUser = Prisma.CommitmentGetPayload<{ include: { user: true } }>;

// Reminder candidates across all users: active, reminder-enabled, and due
// within the widest possible lead window. The cron route applies each
// commitment's own `reminderLeadDays` and the once-per-due-date gate — this
// just narrows the scan cheaply at the DB layer. User is included so the
// sender knows whom to push to.
export async function getCommitmentsDueForReminder(now: Date): Promise<CommitmentWithUser[]> {
  const horizon = new Date(now.getTime() + REMINDER_MAX_LEAD_DAYS * 24 * 60 * 60 * 1000);

  return prisma.commitment.findMany({
    where: {
      isActive: true,
      reminderEnabled: true,
      nextDueDate: { lte: horizon },
    },
    include: { user: true },
  });
}

// Record that a reminder went out for this commitment's current due date.
// Gating on this differing from nextDueDate makes reminders fire once per due
// date and re-arm automatically when the date advances.
export async function markReminderSent(id: string, dueDate: Date): Promise<void> {
  await prisma.commitment.update({
    where: { id },
    data: { reminderSentForDueDate: dueDate },
  });
}
