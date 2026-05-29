import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { commitmentInputSchema } from "@/lib/validation";
import { toMinorUnits } from "@/lib/money";
import { REMINDER_DEFAULT_LEAD_DAYS } from "@/lib/constants";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = commitmentInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    const commitment = await prisma.commitment.create({
      data: {
        userId: session.user.id,
        name: input.name,
        type: input.type,
        amountMinor: toMinorUnits(input.amount),
        currency: input.currency,
        cycle: input.cycle,
        nextDueDate: input.nextDueDate,
        renewalMode: input.renewalMode,
        notes: input.notes ? input.notes : null,
        reminderEnabled: input.reminderEnabled ?? false,
        reminderLeadDays: input.reminderLeadDays ?? REMINDER_DEFAULT_LEAD_DAYS,
      },
    });

    return NextResponse.json({ commitment }, { status: 201 });
  } catch (error) {
    // Token valid but the user row is gone (e.g. account deleted). Treat as
    // unauthenticated so the client re-authenticates instead of 500-ing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}
