import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { signPasskeyToken } from "@/lib/passkey-token";
import {
  AUTH_CHALLENGE_COOKIE,
  rpFromRequest,
  readChallenge,
  credentialIdToBuffer,
} from "@/lib/webauthn";

// Verify a passkey assertion and, on success, return a short-lived token the
// client exchanges for a session via signIn("passkey"). Public by design.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.response !== "object" || body.response === null) {
    return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });
  }

  const credentialId = body.response.id;

  if (typeof credentialId !== "string") {
    return NextResponse.json({ error: "Malformed passkey response" }, { status: 400 });
  }

  const challenge = await readChallenge(request.cookies.get(AUTH_CHALLENGE_COOKIE)?.value);
  const clearCookie = (res: NextResponse) => {
    res.cookies.set(AUTH_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });

    return res;
  };

  if (!challenge) {
    return clearCookie(NextResponse.json({ error: "Your sign-in session expired. Try again." }, { status: 400 }));
  }

  const credential = await prisma.credential.findUnique({ where: { credentialId } });

  if (!credential) {
    return clearCookie(NextResponse.json({ error: "Passkey not recognized." }, { status: 400 }));
  }

  const { rpID, origin } = rpFromRequest(request);

  let verification;

  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      authenticator: {
        credentialID: credentialIdToBuffer(credential.credentialId),
        credentialPublicKey: new Uint8Array(credential.publicKey),
        counter: Number(credential.counter),
        transports: credential.transports
          ? (credential.transports.split(",") as AuthenticatorTransportFuture[])
          : undefined,
      },
    });
  } catch {
    return clearCookie(NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 }));
  }

  if (!verification.verified) {
    return clearCookie(NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 }));
  }

  // Advance the signature counter (clone-detection) and stamp last use.
  await prisma.credential.update({
    where: { id: credential.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  const token = await signPasskeyToken(credential.userId);

  return clearCookie(NextResponse.json({ token }));
}
