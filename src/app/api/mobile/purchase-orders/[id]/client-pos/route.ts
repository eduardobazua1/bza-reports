import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientPurchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db
    .select()
    .from(clientPurchaseOrders)
    .where(eq(clientPurchaseOrders.purchaseOrderId, Number(id)));

  return NextResponse.json(rows);
}
