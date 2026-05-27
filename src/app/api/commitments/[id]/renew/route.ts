import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { advanceByCycle } from "@/lib/cycle";
import type { Cycle } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

// Advance a commitment to its next billing cycle. Used for MANUAL renewals
// ("I paid it") and also works for AUTO commitments the user wants to push
// forward early. Advancing from the current nextDueDate keeps the schedule
// anchored to the original billing day.
export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const commitment = await prisma.commitment.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!commitment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextDueDate = advanceByCycle(commitment.nextDueDate, commitment.cycle as Cycle);

  await prisma.commitment.update({
    where: { id: commitment.id },
    data: { nextDueDate },
  });

  return NextResponse.json({ nextDueDate });
}
