import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, customerPayments, customerPaymentInvoices, purchaseOrders } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceIds, paymentDate, paymentMethod, referenceNo, notes } = await req.json();
  // invoiceIds: number[]
  if (!invoiceIds?.length) return NextResponse.json({ error: "No invoices selected" }, { status: 400 });

  // Get all invoices with their POs
  const rows = await db
    .select()
    .from(invoices)
    .innerJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(inArray(invoices.id, invoiceIds));

  if (!rows.length) return NextResponse.json({ error: "Invoices not found" }, { status: 404 });

  // Calculate total and get clientId from first invoice (they should all be same client)
  const clientId = rows[0].purchase_orders.clientId;
  const totalAmount = rows.reduce((sum, r) => {
    const price = r.invoices.sellPriceOverride ?? r.purchase_orders.sellPrice;
    return sum + r.invoices.quantityTons * price;
  }, 0);

  // Create one payment record for all invoices
  const [payment] = await db.insert(customerPayments).values({
    clientId,
    paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
    amount: totalAmount,
    paymentMethod: paymentMethod || "wire_transfer",
    referenceNo: referenceNo || null,
    notes: notes || null,
  }).returning();

  // Link each invoice to this payment
  for (const row of rows) {
    const price = row.invoices.sellPriceOverride ?? row.purchase_orders.sellPrice;
    const amount = row.invoices.quantityTons * price;
    await db.insert(customerPaymentInvoices).values({
      paymentId: payment.id,
      invoiceId: row.invoices.id,
      invoiceNumber: row.invoices.invoiceNumber,
      amount,
    });
  }

  // Mark all invoices as paid
  await db.update(invoices)
    .set({ customerPaymentStatus: "paid", updatedAt: new Date().toISOString() })
    .where(inArray(invoices.id, invoiceIds));

  revalidatePath("/invoices");
  return NextResponse.json({ ok: true, paymentId: payment.id, total: totalAmount });
}
