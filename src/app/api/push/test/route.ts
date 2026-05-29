import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendPushDiagnostic } from "@/lib/push";

// Fire a sample notification to all of the signed-in user's devices. Proves the
// end-to-end pipeline (subscription stored → VAPID signed → SW shows it) and
// reports the push service's status per device so a silent reject is visible.
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = await sendPushDiagnostic(session.user.id, {
    title: "Straker",
    body: "Notifications are working — you'll be reminded before things are due.",
    url: "/",
    tag: "straker-test",
  });

  if (devices.length === 0) {
    return NextResponse.json(
      { error: "No active devices. Enable notifications on this device first." },
      { status: 409 },
    );
  }

  // 200 even when a device rejected — the client surfaces the status so the
  // user can see e.g. a 403 (key mismatch) rather than a misleading "sent".
  const delivered = devices.filter((d) => d.ok).length;

  return NextResponse.json({ ok: delivered > 0, delivered, devices });
}
