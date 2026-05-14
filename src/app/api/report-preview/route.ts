import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  const filter   = searchParams.get("filter") ?? "active"; // "active" | "all"

  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  let rows = await db
    .select({
      invoiceNumber:    invoices.invoiceNumber,
      poNumber:         purchaseOrders.poNumber,
      clientPoNumber:   purchaseOrders.clientPoNumber,
      item:             invoices.item,
      quantityTons:     invoices.quantityTons,
      shipmentDate:     invoices.shipmentDate,
      shipmentStatus:   invoices.shipmentStatus,
      currentLocation:  invoices.currentLocation,
      estimatedArrival: invoices.estimatedArrival,
      vehicleId:        invoices.vehicleId,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  if (filter === "active") {
    rows = rows.filter(r => r.shipmentStatus !== "entregado");
  }

  return NextResponse.json(rows);
}
