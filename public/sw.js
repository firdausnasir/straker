// Straker service worker — Web Push only. Deliberately no `fetch` handler:
// this is a finance app and a cached shell could show stale due dates. The SW
// exists solely to receive push events and route notification clicks.

self.addEventListener("push", (event) => {
  // Payload is JSON sent by the server (src/lib/push.ts). Fall back to a
  // generic notice if it's missing or unparseable.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Straker";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag, // collapse repeats for the same commitment
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Focus an existing Straker tab if one is open; otherwise open a new one.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
