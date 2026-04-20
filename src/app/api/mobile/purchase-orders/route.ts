import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, clients, suppliers, invoices } from "@/db/schema";
import { eq, desc, sum } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      clientPoNumber: purchaseOrders.clientPoNumber,
      product: purchaseOrders.product,
      plannedTons: purchaseOrders.plannedTons,
      sellPrice: purchaseOrders.sellPrice,
      status: purchaseOrders.status,
      startDate: purchaseOrders.startDate,
      endDate: purchaseOrders.endDate,
      clientName: clients.name,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .orderBy(desc(purchaseOrders.poNumber))
    .limit(100);

  // Get invoiced tons per PO
  const invoicedByPO = await db
    .select({ purchaseOrderId: invoices.purchaseOrderId, total: sum(invoices.quantityTons) })
    .from(invoices)
    .groupBy(invoices.purchaseOrderId);

  const invoicedMap = new Map(invoicedByPO.map(r => [r.purchaseOrderId, Number(r.total) || 0]));

  return NextResponse.json(pos.map(po => ({
    ...po,
    invoicedTons: invoicedMap.get(po.id) || 0,
  })));
}
