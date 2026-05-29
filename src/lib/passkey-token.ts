import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Bridges a verified WebAuthn assertion into a NextAuth session. The login
// verify route mints this short-lived token after the assertion checks out; the
// `passkey` Credentials provider (src/auth.ts) verifies it and issues the JWT
// session. This keeps session-minting inside Auth.js — we never set auth cookies
// by hand — while staying on the JWT-only strategy (no DB adapter).

const TOKEN_TTL = "60s";
const PURPOSE = "passkey-login";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

export async function signPasskeyToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

// Returns the userId only if the token verifies, is unexpired, and carries the
// expected purpose. Null otherwise.
export async function verifyPasskeyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());

    if (payload.purpose !== PURPOSE || typeof payload.sub !== "string") {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}
