import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST — save a new push subscription
export async function POST(req: NextRequest) {
  try {
    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const ua = req.headers.get("user-agent") ?? undefined;

    await db
      .insert(pushSubscriptions)
      .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: keys.p256dh, auth: keys.auth },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — remove a subscription by endpoint
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe DELETE error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
