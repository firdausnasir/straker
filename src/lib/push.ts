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

let configured = false;

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

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

// Send a notification to every device a user has registered. Subscriptions the
// push service reports as gone (404/410) are pruned. Returns how many devices
// actually accepted the push.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  ensureConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return 0;
  }

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        delivered += 1;
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;

        // 404/410 = the subscription is permanently gone. Drop it so we stop
        // trying. Other errors (e.g. transient 5xx) are left for the next run.
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    }),
  );

  return delivered;
}
