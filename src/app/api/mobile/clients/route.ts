import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, purchaseOrders, invoices } from "@/db/schema";
import { eq, sql, sum, count } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allClients = await db.select().from(clients);

  const stats = await db
    .select({
      clientId: purchaseOrders.clientId,
      totalRevenue: sql<number>`sum(coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice}, 0) * ${invoices.quantityTons})`,
      totalTons: sum(invoices.quantityTons),
      activeShipments: sql<number>`sum(case when ${invoices.shipmentStatus} in ('programado','en_transito','en_aduana') then 1 else 0 end)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .groupBy(purchaseOrders.clientId);

  const statsMap = new Map(stats.map(s => [s.clientId, s]));

  return NextResponse.json(allClients.map(c => {
    const s = statsMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      country: c.country,
      portalEnabled: c.portalEnabled,
      totalRevenue: Number(s?.totalRevenue) || 0,
      totalTons: Number(s?.totalTons) || 0,
      activeShipments: Number(s?.activeShipments) || 0,
    };
  }));
}
