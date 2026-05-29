import { NextResponse } from "next/server";
import { getCommitmentsDueForReminder, markReminderSent } from "@/lib/commitments";
import { sendPushToUser } from "@/lib/push";
import { daysUntil, dueLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/constants";

// Scheduled scan (daily; see vercel.json). Guarded by CRON_SECRET — Vercel Cron
// sends `Authorization: Bearer <CRON_SECRET>` automatically; self-host callers
// must send the same header. NOT behind user auth.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const candidates = await getCommitmentsDueForReminder(now);

  let remindersSent = 0;

  for (const c of candidates) {
    const days = daysUntil(c.nextDueDate, now);

    // Within this commitment's own lead window?
    if (days > c.reminderLeadDays) {
      continue;
    }

    // Once per due date: skip if we've already reminded for this exact date.
    if (c.reminderSentForDueDate && c.reminderSentForDueDate.getTime() === c.nextDueDate.getTime()) {
      continue;
    }

    const amount = formatMoney(c.amountMinor, c.currency as Currency);
    const delivered = await sendPushToUser(c.userId, {
      title: "Upcoming commitment",
      body: `${c.name} — due ${dueLabel(c.nextDueDate, now).toLowerCase()} (${amount})`,
      url: "/",
      tag: `due-${c.id}`,
    });

    // Only mark sent once a device actually received it, so a user who enables
    // notifications later still gets the reminder for this due date.
    if (delivered > 0) {
      await markReminderSent(c.id, c.nextDueDate);
      remindersSent += 1;
    }
  }

  return NextResponse.json({ scanned: candidates.length, remindersSent });
}
