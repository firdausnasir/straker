import { NextResponse } from "next/server";
import { advanceLapsedAutoCommitments } from "@/lib/commitments";

// Scheduled cycle roll-forward (daily 00:10 MYT / 16:10 UTC; see vercel.json).
// This is the ONLY place AUTO commitments advance — reads no longer do it.
// Runs ahead of the reminder scan (09:00 MYT) so reminders see fresh due dates.
// Guarded by CRON_SECRET — Vercel Cron sends `Authorization: Bearer
// <CRON_SECRET>` automatically; self-host callers must send the same header.
// NOT behind user auth.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const advanced = await advanceLapsedAutoCommitments(new Date());

  return NextResponse.json({ advanced });
}
