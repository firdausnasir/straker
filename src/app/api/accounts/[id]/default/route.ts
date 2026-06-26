import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { setDefaultAccount, clearDefaultAccount, AccountNotFoundError } from "@/lib/accounts";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // This endpoint takes no payload — the target account comes from the URL —
    // so we deliberately do not read or require a request body.
    await setDefaultAccount(session.user.id, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Foreign or unknown account id — never reveal it exists for another user.
    if (error instanceof AccountNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Token valid but the user row is gone. Treat as unauthenticated so the
    // client re-authenticates instead of 500-ing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}

export async function DELETE(_request: Request, _context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Clearing is idempotent at the lib layer (no-op if already null), so no
    // ownership/existence check is needed here.
    await clearDefaultAccount(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Token valid but the user row is gone — re-authenticate, don't 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}
