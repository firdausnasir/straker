import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";

// Browser glue for the passkey ceremonies. Mirrors push-client.ts: thin fetch
// wrappers that throw PasskeyError on failure so callers can toast the message.

export class PasskeyError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PasskeyError";
    this.status = status;
  }
}

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && browserSupportsWebAuthn();
}

// The browser throws NotAllowedError/AbortError when the user dismisses or
// cancels the native prompt — not a real failure, so callers can stay quiet.
export function isPasskeyCancellation(error: unknown): boolean {
  return error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
}

async function errorFrom(res: Response, fallback: string): Promise<PasskeyError> {
  const data = await res.json().catch(() => ({}));

  return new PasskeyError(data.error ?? fallback, res.status);
}

// Best-effort friendly name for a freshly-created passkey, from the transport
// hints + the user agent. WebAuthn gives no real device name (and AAGUID is
// zeroed under attestationType "none"), so this is a guess the user confirms.
function guessPasskeyName(transports?: string[]): string {
  const t = transports ?? [];
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isPlatform = t.includes("internal");

  // Roaming security key (no platform transport).
  if (!isPlatform && (t.includes("usb") || t.includes("nfc") || t.includes("ble"))) {
    return "Security key";
  }

  // Cross-device passkey on a phone, used here via QR/hybrid.
  if (!isPlatform && t.includes("hybrid")) {
    return "Phone";
  }

  // Platform authenticator — name by OS.
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows Hello";
  if (/Linux/i.test(ua)) return "Linux device";

  return "My passkey";
}

// Add or renew the passkey. Password re-auth happens at the options step. When
// no deviceName is given (the add flow), a guessed name is saved as the default
// and returned so the caller can let the user confirm/edit it.
export async function registerPasskey(
  password: string,
  deviceName?: string,
): Promise<{ guessedName: string }> {
  const optionsRes = await fetch("/api/passkey/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!optionsRes.ok) {
    throw await errorFrom(optionsRes, "Could not start passkey setup.");
  }

  const options = await optionsRes.json();
  const response = await startRegistration(options);
  const guessedName = guessPasskeyName(response.response?.transports);

  const verifyRes = await fetch("/api/passkey/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response, deviceName: deviceName ?? guessedName }),
  });

  if (!verifyRes.ok) {
    throw await errorFrom(verifyRes, "Could not save the passkey.");
  }

  return { guessedName };
}

// Run the sign-in ceremony, then exchange the returned token for a session.
export async function loginWithPasskey(): Promise<void> {
  const optionsRes = await fetch("/api/passkey/login/options", { method: "POST" });

  if (!optionsRes.ok) {
    throw await errorFrom(optionsRes, "Could not start passkey sign-in.");
  }

  const options = await optionsRes.json();
  const response = await startAuthentication(options);

  const verifyRes = await fetch("/api/passkey/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });

  if (!verifyRes.ok) {
    throw await errorFrom(verifyRes, "Passkey sign-in failed.");
  }

  const { token } = await verifyRes.json();
  const result = await signIn("passkey", { token, redirect: false });

  if (result?.error) {
    throw new PasskeyError("Passkey sign-in failed.", 401);
  }
}

export async function renamePasskey(deviceName: string): Promise<void> {
  const res = await fetch("/api/passkey/credential", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceName }),
  });

  if (!res.ok) {
    throw await errorFrom(res, "Could not rename the passkey.");
  }
}

export async function deletePasskey(password: string): Promise<void> {
  const res = await fetch("/api/passkey/credential", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    throw await errorFrom(res, "Could not remove the passkey.");
  }
}

export type PasskeySummary = {
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function getPasskey(): Promise<PasskeySummary | null> {
  const res = await fetch("/api/passkey/credential");

  if (res.status === 401) {
    throw new PasskeyError("Unauthorized", 401);
  }

  if (!res.ok) {
    throw new PasskeyError("Could not load passkey.", res.status);
  }

  const data = await res.json();

  return data.credential ?? null;
}
