import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      shipmentDate: invoices.shipmentDate,
      dueDate: invoices.dueDate,
      paymentTermsDays: invoices.paymentTermsDays,
      quantityTons: invoices.quantityTons,
      sellPriceOverride: invoices.sellPriceOverride,
      poSellPrice: purchaseOrders.sellPrice,
      clientPaymentTermsDays: clients.paymentTermsDays,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(
      and(
        eq(purchaseOrders.clientId, Number(clientId)),
        eq(invoices.customerPaymentStatus, "unpaid")
      )
    )
    .orderBy(desc(invoices.shipmentDate));

  return NextResponse.json(rows);
}
