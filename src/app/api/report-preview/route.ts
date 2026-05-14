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
      invoiceNumber:      invoices.invoiceNumber,
      poNumber:           purchaseOrders.poNumber,
      clientPoNumber:     purchaseOrders.clientPoNumber,
      salesDocument:      invoices.salesDocument,
      item:               invoices.item,
      quantityTons:       invoices.quantityTons,
      sellPrice:          purchaseOrders.sellPrice,
      sellPriceOverride:  invoices.sellPriceOverride,
      shipmentDate:       invoices.shipmentDate,
      shipmentStatus:     invoices.shipmentStatus,
      currentLocation:    invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      estimatedArrival:   invoices.estimatedArrival,
      vehicleId:          invoices.vehicleId,
      blNumber:           invoices.blNumber,
      billingDocument:    invoices.billingDocument,
      terms:              purchaseOrders.terms,
      transportType:      purchaseOrders.transportType,
      licenseFsc:         purchaseOrders.licenseFsc,
      chainOfCustody:     purchaseOrders.chainOfCustody,
      inputClaim:         purchaseOrders.inputClaim,
      outputClaim:        purchaseOrders.outputClaim,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  if (filter === "active") {
    rows = rows.filter(r => r.shipmentStatus !== "entregado");
  }

  // Normalise derived fields
  const result = rows.map(r => ({
    ...r,
    clientPoNumber: r.salesDocument || r.clientPoNumber,
    sellPrice:      `$${r.sellPriceOverride ?? r.sellPrice ?? 0}`,
    shipmentStatus: ({ programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered" } as Record<string, string>)[r.shipmentStatus ?? ""] ?? r.shipmentStatus,
    transportType:  r.transportType === "ffcc" ? "FFCC" : r.transportType === "ship" ? "Ship" : r.transportType === "truck" ? "Truck" : r.transportType,
  }));

  return NextResponse.json(result);
}
