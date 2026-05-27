import "server-only";
import type { Commitment } from "@prisma/client";
import { prisma } from "./prisma";
import { advanceToFuture } from "./cycle";
import type { Cycle } from "./constants";

// AUTO commitments roll forward on their own. When the dashboard loads we
// catch up any whose due date has lapsed, so the user only ever sees future
// dates for them. MANUAL commitments are left untouched — the user advances
// those explicitly via the renew action.
async function autoRenewLapsed(userId: string, now: Date): Promise<void> {
  const lapsed = await prisma.commitment.findMany({
    where: {
      userId,
      isActive: true,
      renewalMode: "AUTO",
      nextDueDate: { lte: now },
    },
  });

  if (lapsed.length === 0) {
    return;
  }

  await prisma.$transaction(
    lapsed.map((c) =>
      prisma.commitment.update({
        where: { id: c.id },
        data: { nextDueDate: advanceToFuture(c.nextDueDate, c.cycle as Cycle, now) },
      }),
    ),
  );
}

// Active commitments for a user, sorted by soonest due date first.
export async function getActiveCommitments(userId: string): Promise<Commitment[]> {
  const now = new Date();
  await autoRenewLapsed(userId, now);

  return prisma.commitment.findMany({
    where: { userId, isActive: true },
    orderBy: { nextDueDate: "asc" },
  });
}
