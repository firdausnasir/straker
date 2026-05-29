import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { pushSubscriptionSchema } from "@/lib/validation";

// Persist (or refresh) this device's push subscription for the signed-in user.
// Keyed by endpoint so re-subscribing the same device updates rather than dups.
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid subscription" },
      { status: 400 },
    );
  }

  const { endpoint, keys } = parsed.data;

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    // Token valid but the user row is gone — re-authenticate client-side.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    }

    throw error;
  }
}
