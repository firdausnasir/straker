import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { commitmentUpdateSchema } from "@/lib/validation";
import { toMinorUnits } from "@/lib/money";
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

  // Build the update payload only from fields actually provided.
  const data: Prisma.CommitmentUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.type = input.type;
  if (input.amount !== undefined) data.amountMinor = toMinorUnits(input.amount);
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.cycle !== undefined) data.cycle = input.cycle;
  if (input.nextDueDate !== undefined) data.nextDueDate = input.nextDueDate;
  if (input.renewalMode !== undefined) data.renewalMode = input.renewalMode;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.notes !== undefined) data.notes = input.notes ? input.notes : null;

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
