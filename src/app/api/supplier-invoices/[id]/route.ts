import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(supplierInvoices).where(eq(supplierInvoices.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { paymentStatus, linkedInvoiceId } = body;

  if (paymentStatus !== undefined) {
    await db.update(supplierInvoices).set({ paymentStatus }).where(eq(supplierInvoices.id, Number(id)));
  }
  if (linkedInvoiceId !== undefined) {
    await db.update(supplierInvoices)
      .set({ linkedInvoiceId: linkedInvoiceId === null ? null : Number(linkedInvoiceId) })
      .where(eq(supplierInvoices.id, Number(id)));
  }
  return NextResponse.json({ ok: true });
}
