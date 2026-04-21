import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      purchaseOrderId,
      invoiceNumber,
      salesDocument,
      destination,
      vehicleId,
      blNumber,
      shipmentDate,
      invoiceDate,
      quantityTons,
      item,
      shipmentStatus,
      balesCount,
      unitsPerBale,
      sellPriceOverride,
      buyPriceOverride,
      freightCost,
      clientPoId,
    } = body;

    if (!purchaseOrderId || !invoiceNumber || !quantityTons) {
      return NextResponse.json({ error: "purchaseOrderId, invoiceNumber y quantityTons son requeridos" }, { status: 400 });
    }

    // Check for duplicate invoice number
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.invoiceNumber, invoiceNumber),
    });
    if (existing) {
      return NextResponse.json({ error: `El número de factura "${invoiceNumber}" ya existe` }, { status: 400 });
    }

    // Auto-compute due date: shipmentDate (or invoiceDate) + 60 days
    const TERMS = 60;
    const baseDate = shipmentDate || invoiceDate || null;
    const computedDueDate = baseDate ? (() => {
      const d = new Date(baseDate + "T12:00:00");
      d.setDate(d.getDate() + TERMS);
      return d.toISOString().split("T")[0];
    })() : null;

    const [created] = await db.insert(invoices).values({
      purchaseOrderId: Number(purchaseOrderId),
      invoiceNumber,
      salesDocument: salesDocument || null,
      destination: destination || null,
      vehicleId: vehicleId || null,
      blNumber: blNumber || null,
      shipmentDate: shipmentDate || null,
      invoiceDate: invoiceDate || null,
      quantityTons: Number(quantityTons),
      item: item || null,
      shipmentStatus: shipmentStatus || "programado",
      balesCount: balesCount ? Number(balesCount) : null,
      unitsPerBale: unitsPerBale ? Number(unitsPerBale) : null,
      sellPriceOverride: sellPriceOverride ? Number(sellPriceOverride) : null,
      buyPriceOverride: buyPriceOverride ? Number(buyPriceOverride) : null,
      freightCost: freightCost ? Number(freightCost) : null,
      clientPoId: clientPoId ? Number(clientPoId) : null,
      paymentTermsDays: TERMS,
      dueDate: computedDueDate,
      customerPaymentStatus: "unpaid",
      supplierPaymentStatus: "unpaid",
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
