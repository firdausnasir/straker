import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { cardUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string; cardId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, cardId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cardUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Build the update payload only from fields actually provided.
  const data: Prisma.CardUpdateInput = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.network !== undefined) data.network = input.network ?? null;
  // An empty-string last4 (the schema's cleared-field sentinel) clears it.
  if (input.last4 !== undefined) data.last4 = input.last4 ? input.last4 : null;

  // Scope by the full card→account→user chain so a foreign card, a card under
  // another user's account, or a mismatched (account, card) pair all 404.
  const result = await prisma.card.updateMany({
    where: { id: cardId, accountId: id, account: { userId: session.user.id } },
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

  const { id, cardId } = await params;

  // Same card→account→user scoping as PATCH. Deleting a card SetNulls any
  // commitments that referenced it (schema-level rule from T1).
  const result = await prisma.card.deleteMany({
    where: { id: cardId, accountId: id, account: { userId: session.user.id } },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
