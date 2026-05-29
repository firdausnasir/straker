import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passkeyRegisterVerifySchema } from "@/lib/validation";
import {
  REG_CHALLENGE_COOKIE,
  rpFromRequest,
  readChallenge,
  bufferToCredentialId,
} from "@/lib/webauthn";

const DEFAULT_LABEL = "My passkey";

// Verify the registration ceremony and persist the account's single passkey.
// The password was already proven at the options step (the challenge cookie is
// only issued after that), so this step needs the session + a valid challenge.
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.response !== "object" || body.response === null) {
    return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });
  }

  const parsed = passkeyRegisterVerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const challenge = await readChallenge(request.cookies.get(REG_CHALLENGE_COOKIE)?.value);

  // Bind the challenge to this user so a cookie from another session can't be
  // replayed.
  if (!challenge || challenge.userId !== session.user.id) {
    return NextResponse.json({ error: "Your setup session expired. Try again." }, { status: 400 });
  }

  const { rpID, origin } = rpFromRequest(request);
  const clearCookie = (res: NextResponse) => {
    res.cookies.set(REG_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });

    return res;
  };

  let verification;

  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    return clearCookie(NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 }));
  }

  if (!verification.verified || !verification.registrationInfo) {
    return clearCookie(NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 }));
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const credentialId = bufferToCredentialId(credentialID);
  const transports = Array.isArray(body.response.response?.transports)
    ? body.response.response.transports.join(",")
    : null;
  const deviceName = parsed.data.deviceName ?? DEFAULT_LABEL;

  // One passkey per user (Credential.userId is unique). Upsert replaces the old
  // one on renewal and resets lastUsedAt for the fresh credential.
  await prisma.credential.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      credentialId,
      publicKey: Buffer.from(credentialPublicKey),
      counter: BigInt(counter),
      transports,
      deviceName,
    },
    update: {
      credentialId,
      publicKey: Buffer.from(credentialPublicKey),
      counter: BigInt(counter),
      transports,
      deviceName,
      lastUsedAt: null,
    },
  });

  return clearCookie(NextResponse.json({ ok: true }, { status: 201 }));
}
