import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { accountInputSchema } from "@/lib/validation";
import { getAccountsWithCards } from "@/lib/accounts";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // getAccountsWithCards is user-scoped, so this can only ever return the
  // caller's own accounts — IDs from elsewhere never enter the query.
  const accounts = await getAccountsWithCards(session.user.id);

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = accountInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    const account = await prisma.paymentAccount.create({
      data: {
        userId: session.user.id,
        name: input.name,
        type: input.type,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    // Token valid but the user row is gone (e.g. account deleted). Treat as
    // unauthenticated so the client re-authenticates instead of 500-ing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}
