import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      billingDocument: invoices.billingDocument,
      quantityTons: invoices.quantityTons,
      shipmentDate: invoices.shipmentDate,
      estimatedArrival: invoices.estimatedArrival,
      shipmentStatus: invoices.shipmentStatus,
      currentLocation: invoices.currentLocation,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      destination: invoices.destination,
      clientName: clients.name,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .orderBy(desc(invoices.shipmentDate))
    .limit(200);

  return NextResponse.json(rows);
}
