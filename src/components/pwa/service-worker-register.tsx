"use client";

import { useEffect } from "react";

// Registers the push service worker once on mount. Renders nothing. Kept out
// of the notification-settings flow so the SW is available before the user
// opens Settings (subscribing needs an active registration).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app works without push.
    });
  }, []);

  return null;
}
