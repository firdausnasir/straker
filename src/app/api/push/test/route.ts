import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendPushToUser } from "@/lib/push";

// Fire a sample notification to all of the signed-in user's devices. Proves the
// end-to-end pipeline (subscription stored → VAPID signed → SW shows it).
export async function POST() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const delivered = await sendPushToUser(session.user.id, {
    title: "Straker",
    body: "Notifications are working — you'll be reminded before things are due.",
    url: "/",
    tag: "straker-test",
  });

  if (delivered === 0) {
    return NextResponse.json(
      { error: "No active devices. Enable notifications on this device first." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, delivered });
}
