import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      billingDocument: invoices.billingDocument,
      quantityTons: invoices.quantityTons,
      shipmentDate: invoices.shipmentDate,
      shipmentStatus: invoices.shipmentStatus,
      customerPaymentStatus: invoices.customerPaymentStatus,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice}, 0)`,
      clientPoId: invoices.clientPoId,
      salesDocument: invoices.salesDocument,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(invoices.purchaseOrderId, Number(id)))
    .orderBy(desc(invoices.shipmentDate));

  return NextResponse.json(rows);
}
