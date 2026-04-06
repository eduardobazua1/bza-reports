import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceEmailLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get("t");

  if (trackingId) {
    try {
      const now = new Date().toISOString();
      const log = await db.query.invoiceEmailLogs.findFirst({
        where: eq(invoiceEmailLogs.trackingId, trackingId),
      });

      if (log) {
        await db
          .update(invoiceEmailLogs)
          .set({
            openCount: sql`${invoiceEmailLogs.openCount} + 1`,
            firstOpenedAt: log.firstOpenedAt ?? now,
            lastOpenedAt: now,
          })
          .where(eq(invoiceEmailLogs.trackingId, trackingId));
      }
    } catch {
      // Never fail on tracking errors
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
    },
  });
}
