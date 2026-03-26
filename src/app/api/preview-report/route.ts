import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { clientId, columns, filter } = await req.json() as {
    clientId: number;
    columns: string[];
    filter?: "active" | "all";
  };

  let rows = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      clientPoNumber: purchaseOrders.clientPoNumber,
      invoiceNumber: invoices.invoiceNumber,
      quantityTons: invoices.quantityTons,
      sellPrice: purchaseOrders.sellPrice,
      sellPriceOverride: invoices.sellPriceOverride,
      buyPrice: purchaseOrders.buyPrice,
      buyPriceOverride: invoices.buyPriceOverride,
      item: invoices.item,
      product: purchaseOrders.product,
      shipmentDate: invoices.shipmentDate,
      shipmentStatus: invoices.shipmentStatus,
      terms: purchaseOrders.terms,
      transportType: purchaseOrders.transportType,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      salesDocument: invoices.salesDocument,
      billingDocument: invoices.billingDocument,
      currentLocation: invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      estimatedArrival: invoices.estimatedArrival,
      licenseFsc: purchaseOrders.licenseFsc,
      chainOfCustody: purchaseOrders.chainOfCustody,
      inputClaim: purchaseOrders.inputClaim,
      outputClaim: purchaseOrders.outputClaim,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  // Apply filter
  if (filter === "active") {
    rows = rows.filter((r) => r.shipmentStatus !== "entregado");
  }

  const colMap: Record<string, { header: string; getValue: (r: typeof rows[0]) => string | number | null }> = {
    currentLocation: { header: "Current Location", getValue: (r) => r.currentLocation },
    lastLocationUpdate: { header: "Last Update", getValue: (r) => r.lastLocationUpdate },
    poNumber: { header: "Purchase Order", getValue: (r) => r.poNumber },
    clientPoNumber: { header: "Client PO", getValue: (r) => r.salesDocument || r.clientPoNumber },
    invoiceNumber: { header: "Invoice", getValue: (r) => r.invoiceNumber },
    vehicleId: { header: "Vehicle ID", getValue: (r) => r.vehicleId },
    blNumber: { header: "BL Number", getValue: (r) => r.blNumber },
    quantityTons: { header: "Transport Qty", getValue: (r) => r.quantityTons },
    sellPrice: { header: "Net Price", getValue: (r) => `$${(r.sellPriceOverride ?? r.sellPrice ?? 0)}` },
    billingDocument: { header: "Billing Doc.", getValue: (r) => r.billingDocument },
    item: { header: "Item", getValue: (r) => r.item || r.product },
    shipmentDate: { header: "Shipment Date", getValue: (r) => r.shipmentDate },
    shipmentStatus: { header: "Status", getValue: (r) => ({ programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered" }[r.shipmentStatus] || r.shipmentStatus) },
    estimatedArrival: { header: "ETA", getValue: (r) => r.estimatedArrival },
    terms: { header: "Terms", getValue: (r) => r.terms },
    transportType: { header: "Transport", getValue: (r) => r.transportType === "ffcc" ? "FFCC" : r.transportType === "ship" ? "Ship" : r.transportType === "truck" ? "Truck" : r.transportType },
    licenseFsc: { header: "License #", getValue: (r) => r.licenseFsc },
    chainOfCustody: { header: "Chain of Custody", getValue: (r) => r.chainOfCustody },
    inputClaim: { header: "Input Claim", getValue: (r) => r.inputClaim },
    outputClaim: { header: "Output Claim", getValue: (r) => r.outputClaim },
  };

  const selectedCols = columns.filter((c) => colMap[c]);
  const headers = selectedCols.map((c) => colMap[c].header);
  const data = rows.map((r) => selectedCols.map((c) => colMap[c].getValue(r)));

  return NextResponse.json({ headers, data, totalRows: rows.length });
}
