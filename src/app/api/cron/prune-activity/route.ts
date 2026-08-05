import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { and, eq, lt, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Retention policy (days). Page views are noisy → pruned fast; audit trail kept long.
const VIEW_RETENTION_DAYS = 30;
const AUDIT_RETENTION_DAYS = 365;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

async function prune() {
  const now = Date.now();
  const viewCutoff = new Date(now - VIEW_RETENTION_DAYS * 86_400_000).toISOString();
  const auditCutoff = new Date(now - AUDIT_RETENTION_DAYS * 86_400_000).toISOString();

  // ISO-8601 timestamps compare correctly as text, so lexicographic < works here.
  const views = await db
    .delete(activityLog)
    .where(and(eq(activityLog.action, "view"), lt(activityLog.createdAt, viewCutoff)))
    .returning({ id: activityLog.id });

  const audit = await db
    .delete(activityLog)
    .where(and(ne(activityLog.action, "view"), lt(activityLog.createdAt, auditCutoff)))
    .returning({ id: activityLog.id });

  return { ok: true, deletedViews: views.length, deletedAudit: audit.length, viewCutoff, auditCutoff };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await prune());
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await prune());
}
