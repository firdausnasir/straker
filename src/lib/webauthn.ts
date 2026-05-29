import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

// WebAuthn relying-party config + short-lived challenge cookies. The challenge
// must survive the round-trip between the options and verify requests; we hold
// it in a signed, httpOnly cookie (no DB row to store/clean up). Signed with
// AUTH_SECRET so a client can't forge or read it.

export const RP_NAME = "Commitment Tracker";

// One cookie per ceremony so a registration challenge can't be replayed as an
// authentication challenge (or vice versa).
export const REG_CHALLENGE_COOKIE = "pk_reg_chal";
export const AUTH_CHALLENGE_COOKIE = "pk_auth_chal";

const CHALLENGE_TTL_SECONDS = 300;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

type ChallengePayload = { challenge: string; userId?: string };

export async function signChallenge(payload: ChallengePayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(secretKey());
}

// Returns the payload only if the cookie verifies and hasn't expired.
export async function readChallenge(token: string | undefined): Promise<ChallengePayload | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey());

    return { challenge: payload.challenge as string, userId: payload.userId as string | undefined };
  } catch {
    return null;
  }
}

// Cookie attributes for the challenge. Secure only over https so localhost dev
// (http) still works; SameSite=Lax is fine because the verify request is a
// same-site fetch.
export function challengeCookieOptions(request: Request) {
  const isHttps = new URL(request.url).protocol === "https:";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  };
}

// Derive the relying-party ID (hostname) and expected origin from the request's
// Origin header. Keeps localhost / prod / self-host working with no env var.
export function rpFromRequest(request: Request): { rpID: string; origin: string } {
  const origin = request.headers.get("origin");

  if (!origin) {
    throw new Error("Missing Origin header");
  }

  return { rpID: new URL(origin).hostname, origin };
}

export const credentialIdToBuffer = (id: string): Uint8Array => isoBase64URL.toBuffer(id);
export const bufferToCredentialId = (buf: Uint8Array): string => isoBase64URL.fromBuffer(buf);
