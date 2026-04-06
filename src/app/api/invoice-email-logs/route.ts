import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceEmailLogs, invoices } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const invoiceNumber = req.nextUrl.searchParams.get("invoiceNumber");
  if (!invoiceNumber) {
    return NextResponse.json({ error: "invoiceNumber required" }, { status: 400 });
  }

  const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });
  if (!inv) return NextResponse.json([]);

  const logs = await db
    .select()
    .from(invoiceEmailLogs)
    .where(eq(invoiceEmailLogs.invoiceId, inv.id))
    .orderBy(desc(invoiceEmailLogs.sentAt));

  return NextResponse.json(logs);
}
