import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { passkeyLabelSchema, passwordReauthSchema } from "@/lib/validation";

// The account's single passkey: read summary, rename, or delete. Add/renew live
// under register/* because they need the full WebAuthn ceremony.

// GET — summary for Settings (never the credentialId or public key).
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credential = await prisma.credential.findUnique({
    where: { userId: session.user.id },
    select: { deviceName: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({ credential: credential ?? null });
}

// PATCH — rename the label. No password (a label change isn't sensitive).
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passkeyLabelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    await prisma.credential.update({
      where: { userId: session.user.id },
      data: { deviceName: parsed.data.deviceName },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "No passkey to rename" }, { status: 404 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove the passkey. Requires the password as re-authentication.
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordReauthSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (!user) {
    return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  try {
    await prisma.credential.delete({ where: { userId: session.user.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "No passkey to delete" }, { status: 404 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
