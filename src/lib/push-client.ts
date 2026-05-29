// Client-side Web Push helpers. No server imports — safe in "use client".

// Push needs a service worker, the Push API, and the Notification API. Older /
// locked-down browsers (notably iOS outside an installed PWA) lack one of these.
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID public keys are base64url; PushManager wants a Uint8Array. Back it with
// a concrete ArrayBuffer so it satisfies BufferSource (not SharedArrayBuffer).
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

// Subscribe this device and return the serialized subscription for the server.
// Reuses an existing subscription if the SW already has one.
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  return subscription.toJSON();
}

// Unsubscribe this device locally. Returns the endpoint that was removed (so
// the caller can tell the server to delete its row), or null if none existed.
export async function unsubscribeFromPush(): Promise<string | null> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return null;
  }

  const { endpoint } = subscription;
  await subscription.unsubscribe();

  return endpoint;
}

// True if this device currently holds an active push subscription.
export async function getExistingSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return subscription ? subscription.toJSON() : null;
}
