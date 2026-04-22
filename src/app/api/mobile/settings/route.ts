import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq, sql, count, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = verifyMobileToken(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];

  const [
    clientCount,
    supplierCount,
    invoiceCount,
    poCount,
    lastInvoice,
    lastShipment,
    overdueInvoices,
    transitShipments,
    unpaidInvoices,
  ] = await Promise.all([
    db.select({ count: count() }).from(clients),
    db.select({ count: count() }).from(suppliers),
    db.select({ count: count() }).from(invoices),
    db.select({ count: count() }).from(purchaseOrders),
    db.select({ date: invoices.invoiceDate }).from(invoices).orderBy(desc(invoices.invoiceDate)).limit(1),
    db.select({ date: invoices.shipmentDate }).from(invoices).orderBy(desc(invoices.shipmentDate)).limit(1),
    db.select({
      count: count(),
      amount: sql<number>`sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, 0))`,
    }).from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .where(sql`${invoices.customerPaymentStatus} = 'unpaid' AND ${invoices.dueDate} < ${today}`),
    db.select({ count: count() }).from(invoices)
      .where(sql`${invoices.shipmentStatus} IN ('en_transito', 'programado')`),
    db.select({ count: count() }).from(invoices)
      .where(eq(invoices.customerPaymentStatus, "unpaid")),
  ]);

  // For overdue amount use proper join
  const overdueRows = await db.select({
    quantityTons: invoices.quantityTons,
    sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
  }).from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(sql`${invoices.customerPaymentStatus} = 'unpaid' AND ${invoices.dueDate} < ${today}`);

  const overdueAmount = overdueRows.reduce((sum, r) => sum + r.quantityTons * r.sellPrice, 0);

  return NextResponse.json({
    company: {
      name: "BZA International Services, LLC",
      email: "info@bza-is.com",
      clients: clientCount[0]?.count || 0,
      suppliers: supplierCount[0]?.count || 0,
    },
    alerts: {
      overdueCount: overdueInvoices[0]?.count || 0,
      overdueAmount,
      shipmentsDue: transitShipments[0]?.count || 0,
      unpaidCount: unpaidInvoices[0]?.count || 0,
    },
    lastUpdate: {
      invoiceDate: lastInvoice[0]?.date || null,
      shipmentDate: lastShipment[0]?.date || null,
    },
    stats: {
      totalInvoices: invoiceCount[0]?.count || 0,
      totalPOs: poCount[0]?.count || 0,
      totalShipments: invoiceCount[0]?.count || 0,
    },
  });
}
