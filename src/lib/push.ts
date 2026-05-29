import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

// Web Push sender. VAPID details come from env (see scripts/setup-push-env.mjs).
// Endpoints are bearer secrets — nothing here logs endpoint, keys, or payload.

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// Per-device outcome for diagnostics. `host` is the push-service host only
// (e.g. web.push.apple.com) — never the full endpoint, which is a bearer secret.
export type PushDeliveryResult = {
  host: string;
  statusCode?: number;
  ok: boolean;
};

let configured = false;

// Apple's APNs strictly validates the VAPID `sub` claim: a mailto: address
// wrapped in angle brackets or padded with a space (e.g. "mailto: <a@b.com>",
// the git-author shape that's easy to paste into an env var) is rejected with
// 403 BadJwtToken. FCM accepts it, so the bug surfaces as "Android works, iOS
// doesn't". Normalize to the bare "mailto:addr" Apple requires.
function normalizeVapidSubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed.startsWith("mailto:")) {
    return trimmed;
  }

  const address = trimmed.slice("mailto:".length).trim().replace(/^<|>$/g, "").trim();

  return `mailto:${address}`;
}

// Configure web-push once, lazily, so a missing key fails at send time with a
// clear message rather than crashing module import across the whole app.
function ensureConfigured(): void {
  if (configured) {
    return;
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error(
      "Web Push is not configured: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (run scripts/setup-push-env.mjs).",
    );
  }

  webpush.setVapidDetails(normalizeVapidSubject(VAPID_SUBJECT), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

// Deliver one payload to one subscription and report the push service's status.
// 404/410 = the subscription is permanently gone, so prune it; other failures
// (transient 5xx, signature 403, etc.) are reported but left for the next run.
async function deliver(
  sub: { endpoint: string; p256dh: string; auth: string },
  body: string,
): Promise<PushDeliveryResult> {
  const host = new URL(sub.endpoint).host;

  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
    );

    return { host, statusCode: res.statusCode, ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
    }

    return { host, statusCode, ok: false };
  }
}

// Send a notification to every device a user has registered. Returns how many
// devices actually accepted the push.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  ensureConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return 0;
  }

  const body = JSON.stringify(payload);
  const results = await Promise.all(subscriptions.map((sub) => deliver(sub, body)));

  return results.filter((r) => r.ok).length;
}

// Same delivery, but returns the per-device outcome (host + status code) so the
// test endpoint can show exactly how the push service responded. Diagnostics
// only — the scheduled sender uses sendPushToUser.
export async function sendPushDiagnostic(
  userId: string,
  payload: PushPayload,
): Promise<PushDeliveryResult[]> {
  ensureConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify(payload);

  return Promise.all(subscriptions.map((sub) => deliver(sub, body)));
}
