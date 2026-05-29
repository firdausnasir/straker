import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { passwordReauthSchema } from "@/lib/validation";
import {
  RP_NAME,
  REG_CHALLENGE_COOKIE,
  rpFromRequest,
  signChallenge,
  challengeCookieOptions,
} from "@/lib/webauthn";

// Start adding (or renewing) the account's single passkey. Requires the
// password as re-authentication — the session JWT is effectively permanent, so
// every passkey change re-proves the password.
export async function POST(request: Request) {
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

  const { rpID } = rpFromRequest(request);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: user.id,
    userName: user.email,
    attestationType: "none",
    // Discoverable credential so sign-in works without first naming the user.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    // No excludeCredentials: only one passkey is kept per account (the verify
    // step upserts), and excluding would block renewing on the same device.
  });

  const cookie = await signChallenge({ challenge: options.challenge, userId: user.id });
  const res = NextResponse.json(options);
  res.cookies.set(REG_CHALLENGE_COOKIE, cookie, challengeCookieOptions(request));

  return res;
}
