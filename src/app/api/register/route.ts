import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { credentialsSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";

// Create an account. Sign-in is handled separately by Auth.js (the client
// calls signIn right after a successful registration).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  try {
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password) },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
    }

    throw error;
  }
}
