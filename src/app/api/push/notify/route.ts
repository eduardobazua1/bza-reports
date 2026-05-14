import { NextRequest, NextResponse } from "next/server";
import * as webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getNotifications } from "@/lib/get-notifications";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  // Protect cron endpoint with a shared secret
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await getNotifications();
  if (notifications.length === 0) {
    return NextResponse.json({ sent: 0, message: "Nothing to notify" });
  }

  const critical = notifications.filter(n => n.severity === "critical").length;
  const warning  = notifications.filter(n => n.severity === "warning").length;
  const info     = notifications.filter(n => n.severity === "info").length;

  // Build a concise summary line
  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (warning  > 0) parts.push(`${warning} warning${warning > 1 ? "s" : ""}`);
  if (info     > 0) parts.push(`${info} info`);

  const payload = JSON.stringify({
    title: `BZA. — ${notifications.length} alert${notifications.length !== 1 ? "s" : ""}`,
    body: parts.join(" · "),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/notifications",
  });

  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  const expired: number[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        // 410 Gone = subscription expired / revoked
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expired.push(sub.id);
        }
      }
    })
  );

  // Clean up expired subscriptions
  for (const id of expired) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  return NextResponse.json({ sent, expired: expired.length, total: subs.length });
}
