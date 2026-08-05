import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierPayments, supplierPaymentInvoices, bankTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pid = Number(id);
  // Clear dependents first, else the delete fails (FK) and the row reappears on reload.
  await db.delete(supplierPaymentInvoices).where(eq(supplierPaymentInvoices.paymentId, pid));
  await db.update(bankTransactions).set({ reconciledSupplierPaymentId: null }).where(eq(bankTransactions.reconciledSupplierPaymentId, pid));
  await db.delete(supplierPayments).where(eq(supplierPayments.id, pid));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { actualTons, adjustmentStatus, purchaseOrderId } = body;

  // Simple PO assignment — update only purchaseOrderId
  if (purchaseOrderId !== undefined && actualTons === undefined && adjustmentStatus === undefined) {
    await db
      .update(supplierPayments)
      .set({ purchaseOrderId: purchaseOrderId === null ? null : Number(purchaseOrderId) })
      .where(eq(supplierPayments.id, Number(id)));
    return NextResponse.json({ ok: true });
  }

  const [payment] = await db
    .select()
    .from(supplierPayments)
    .where(eq(supplierPayments.id, Number(id)));

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pricePerTon = payment.pricePerTon ?? (
    payment.estimatedTons && payment.estimatedTons > 0
      ? payment.amountUsd / payment.estimatedTons
      : null
  );

  let adjustmentAmount: number | null = null;
  if (actualTons != null && payment.estimatedTons != null && pricePerTon != null) {
    adjustmentAmount = (actualTons - payment.estimatedTons) * pricePerTon;
  }

  const newStatus = adjustmentStatus || (
    adjustmentAmount != null && Math.abs(adjustmentAmount) > 0.01
      ? "pending"
      : adjustmentAmount != null
      ? "na"
      : payment.adjustmentStatus
  );

  const actualAmount = actualTons != null && pricePerTon != null
    ? actualTons * pricePerTon
    : null;

  await db
    .update(supplierPayments)
    .set({
      actualTons: actualTons ?? payment.actualTons,
      actualAmount: actualAmount ?? payment.actualAmount,
      adjustmentAmount: adjustmentAmount ?? payment.adjustmentAmount,
      adjustmentStatus: newStatus as "pending" | "settled" | "na",
    })
    .where(eq(supplierPayments.id, Number(id)));

  return NextResponse.json({ ok: true });
}
