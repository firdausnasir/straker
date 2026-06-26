import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { accountUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = accountUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Build the update payload only from fields actually provided.
  const data: Prisma.PaymentAccountUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  // An explicit empty string means "clear the last4" → persist as null;
  // an absent field leaves the column untouched.
  if (input.last4 !== undefined) data.last4 = input.last4 || null;

  // Scope the update to the owner so one user can't touch another's account.
  // A non-existent or foreign id matches 0 rows → 404.
  const result = await prisma.paymentAccount.updateMany({
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

  // Owner-scoped delete; SetNulls any linked commitments and clears this
  // account as any user's default (schema-level SetNull rules).
  const result = await prisma.paymentAccount.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
