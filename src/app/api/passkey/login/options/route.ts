import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import {
  AUTH_CHALLENGE_COOKIE,
  rpFromRequest,
  signChallenge,
  challengeCookieOptions,
} from "@/lib/webauthn";

// Start a passkey sign-in. Public by design (the user isn't authenticated yet).
// No allowCredentials — the passkey is discoverable, so the authenticator
// offers the matching credential without us naming the user up front.
export async function POST(request: Request) {
  const { rpID } = rpFromRequest(request);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  const cookie = await signChallenge({ challenge: options.challenge });
  const res = NextResponse.json(options);
  res.cookies.set(AUTH_CHALLENGE_COOKIE, cookie, challengeCookieOptions(request));

  return res;
}
