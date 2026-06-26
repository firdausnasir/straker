import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { commitmentUpdateSchema } from "@/lib/validation";
import { toMinorUnits } from "@/lib/money";
import { getAccountForUser } from "@/lib/accounts";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = commitmentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // A non-null accountId must belong to the session user — never trust the body
  // for ownership. A literal null is allowed: it clears the link (SetNull relation).
  if (input.accountId != null && !(await getAccountForUser(session.user.id, input.accountId))) {
    return NextResponse.json({ error: "Unknown account" }, { status: 400 });
  }

  // Build the update payload only from fields actually provided. Unchecked
  // variant so the scalar `accountId` FK can be set/cleared directly (updateMany
  // takes scalar mutation input, not the relation form).
  const data: Prisma.CommitmentUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.amount !== undefined) data.amountMinor = toMinorUnits(input.amount);
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.cycle !== undefined) data.cycle = input.cycle;
  if (input.nextDueDate !== undefined) data.nextDueDate = input.nextDueDate;
  if (input.renewalMode !== undefined) data.renewalMode = input.renewalMode;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.notes !== undefined) data.notes = input.notes ? input.notes : null;
  if (input.reminderEnabled !== undefined) data.reminderEnabled = input.reminderEnabled;
  if (input.reminderLeadDays !== undefined) data.reminderLeadDays = input.reminderLeadDays;
  // Scalar FK set/clear; updateMany takes the scalar (null clears via SetNull).
  if (input.accountId !== undefined) data.accountId = input.accountId ?? null;

  // Scope the update to the owner so one user can't touch another's rows.
  const result = await prisma.commitment.updateMany({
    where: { id, userId: session.user.id },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await prisma.commitment.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
