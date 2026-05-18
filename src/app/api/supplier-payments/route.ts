import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierPayments, supplierPaymentInvoices } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json();
  const {
    supplierId, purchaseOrderId, amountUsd, paymentDate,
    estimatedTons, pricePerTon, paymentMethod, reference, notes,
    invoices: invoiceLinks,
  } = body;

  if (!supplierId || !amountUsd || !paymentDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const hasInvoices = Array.isArray(invoiceLinks) && invoiceLinks.length > 0;

  const [payment] = await db
    .insert(supplierPayments)
    .values({
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      amountUsd,
      paymentDate,
      estimatedTons: estimatedTons || null,
      pricePerTon: pricePerTon || null,
      paymentMethod: paymentMethod || null,
      reference: reference || null,
      notes: notes || null,
      adjustmentStatus: hasInvoices ? "pending" : "na",
    })
    .returning();

  if (hasInvoices) {
    await db.insert(supplierPaymentInvoices).values(
      invoiceLinks.map((inv: { invoiceId?: number; invoiceNumber: string; estimatedTons?: number }) => ({
        paymentId: payment.id,
        invoiceId: inv.invoiceId || null,
        invoiceNumber: inv.invoiceNumber,
        estimatedTons: inv.estimatedTons || null,
      }))
    );
  }

  return NextResponse.json(payment);
}
