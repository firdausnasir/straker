"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
} from "@/lib/push-client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Device-level push enablement: subscribe/unsubscribe this browser and store the
// subscription server-side. Per-commitment reminders only fire on devices that
// have been enabled here. Reminder choice itself lives in the commitment dialog.
export function NotificationsSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const ok = isPushSupported() && Boolean(VAPID_PUBLIC_KEY);

    // Resolve support + existing subscription in the async callback so we never
    // setState synchronously in the effect body. getExistingSubscription returns
    // null when push is unsupported.
    getExistingSubscription()
      .then((sub) => {
        if (!active) return;
        setSupported(ok);
        setEnabled(Boolean(sub));
      })
      .catch(() => {
        if (active) setSupported(ok);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleToggle(next: boolean) {
    if (busy) {
      return;
    }
    setBusy(true);

    try {
      if (next) {
        // Triggers the browser permission prompt; throws if the user denies.
        const subscription = await subscribeToPush(VAPID_PUBLIC_KEY!);
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });

        if (res.status === 401) {
          void signOut({ redirectTo: "/login" });
          return;
        }
        if (!res.ok) {
          throw new Error("subscribe failed");
        }

        setEnabled(true);
        toast.success("Notifications enabled on this device");
      } else {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }

        setEnabled(false);
        toast.success("Notifications disabled on this device");
      }
    } catch {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast.error("Notifications are blocked. Allow them in your browser settings, then try again.");
      } else {
        toast.error("Couldn't update notifications. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);

    try {
      const res = await fetch("/api/push/test", { method: "POST" });

      if (res.status === 401) {
        void signOut({ redirectTo: "/login" });
        return;
      }
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? "Couldn't send the test.");
        return;
      }

      // Surface the push service's per-device response. A rejected push (e.g.
      // 403 = VAPID key mismatch) otherwise looks identical to a delivered one.
      const devices: { host: string; statusCode?: number; ok: boolean }[] = data.devices ?? [];
      const failed = devices.filter((d) => !d.ok);

      if (failed.length > 0) {
        const detail = failed.map((d) => `${d.host} (${d.statusCode ?? "no status"})`).join(", ");
        toast.error(`Push rejected by ${detail}`);
      } else {
        toast.success(`Test sent to ${devices.length} device${devices.length === 1 ? "" : "s"}`);
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Notifications</h2>
      <div className="surface px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--clay-tint)] text-primary">
            <Bell className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-foreground">
              Due-date reminders
            </span>
            <span className="block text-[13px] text-muted-foreground">
              {supported === false
                ? "This browser doesn't support push notifications"
                : "Get a push before a commitment is due"}
            </span>
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={supported !== true || busy}
            aria-label="Enable notifications on this device"
          />
        </div>

        {enabled && (
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={busy}
            className="mt-5 h-11 w-full justify-center gap-2 rounded-full text-[14px]"
          >
            <Send className="h-4 w-4" />
            Send a test notification
          </Button>
        )}
      </div>
    </section>
  );
}
