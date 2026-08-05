import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  invoices, shipmentUpdates, documents, invoiceEmailLogs,
  supplierPaymentInvoices, customerPaymentInvoices, supplierPayments,
  supplierInvoices, creditMemos, bankTransactions, operatingExpenses,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const iid = Number(id);

  // Same dependent cleanup as the web endpoint, else the delete fails / orphans rows.
  await db.delete(shipmentUpdates).where(eq(shipmentUpdates.invoiceId, iid));
  await db.delete(documents).where(eq(documents.invoiceId, iid));
  await db.delete(invoiceEmailLogs).where(eq(invoiceEmailLogs.invoiceId, iid));
  await db.delete(supplierPaymentInvoices).where(eq(supplierPaymentInvoices.invoiceId, iid));
  await db.delete(customerPaymentInvoices).where(eq(customerPaymentInvoices.invoiceId, iid));
  await db.update(supplierPayments).set({ invoiceId: null }).where(eq(supplierPayments.invoiceId, iid));
  await db.update(supplierInvoices).set({ linkedInvoiceId: null }).where(eq(supplierInvoices.linkedInvoiceId, iid));
  await db.update(creditMemos).set({ invoiceId: null }).where(eq(creditMemos.invoiceId, iid));
  await db.update(bankTransactions).set({ reconciledInvoiceId: null }).where(eq(bankTransactions.reconciledInvoiceId, iid));
  await db.update(operatingExpenses).set({ invoiceId: null }).where(eq(operatingExpenses.invoiceId, iid));
  await db.delete(invoices).where(eq(invoices.id, iid));

  revalidatePath("/invoices");
  return NextResponse.json({ ok: true });
}
