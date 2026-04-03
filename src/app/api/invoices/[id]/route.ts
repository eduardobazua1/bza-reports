import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Recompute dueDate whenever shipmentDate changes
  const TERMS = 60;
  const baseDate = body.shipmentDate || body.invoiceDate || null;
  const computedDueDate = baseDate ? (() => {
    const d = new Date(baseDate + "T12:00:00");
    d.setDate(d.getDate() + TERMS);
    return d.toISOString().split("T")[0];
  })() : null;

  const updated = await db
    .update(invoices)
    .set({
      invoiceNumber: body.invoiceNumber,
      salesDocument: body.salesDocument ?? null,
      destination: body.destination ?? null,
      vehicleId: body.vehicleId ?? null,
      blNumber: body.blNumber ?? null,
      shipmentDate: body.shipmentDate ?? null,
      invoiceDate: body.invoiceDate ?? null,
      quantityTons: body.quantityTons,
      item: body.item ?? null,
      balesCount: body.balesCount ? Number(body.balesCount) : null,
      unitsPerBale: body.unitsPerBale ? Number(body.unitsPerBale) : null,
      sellPriceOverride: body.sellPriceOverride ? Number(body.sellPriceOverride) : null,
      buyPriceOverride: body.buyPriceOverride ? Number(body.buyPriceOverride) : null,
      freightCost: body.freightCost ? Number(body.freightCost) : null,
      shipmentStatus: body.shipmentStatus ?? "programado",
      customerPaymentStatus: body.customerPaymentStatus ?? "unpaid",
      notes: body.notes ?? null,
      paymentTermsDays: TERMS,
      dueDate: computedDueDate,
    })
    .where(eq(invoices.id, Number(id)))
    .returning();

  return NextResponse.json(updated[0]);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(invoices).where(eq(invoices.id, Number(id)));
  return NextResponse.json({ ok: true });
}
