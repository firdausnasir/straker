import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { cardInputSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cardInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // The parent account id comes from the URL; confirm the caller owns it before
  // creating a card under it. A foreign/unknown account never matches → 404.
  const account = await prisma.paymentAccount.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // An empty-string last4 (the schema's cleared-field sentinel) means "no
  // last4" — store null, not "".
  const last4 = input.last4 ? input.last4 : null;

  try {
    const card = await prisma.card.create({
      data: {
        accountId: account.id,
        label: input.label,
        last4,
        network: input.network ?? null,
      },
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    // Token valid but the user row is gone (e.g. account deleted). Treat as
    // unauthenticated so the client re-authenticates instead of 500-ing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}
