import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, customerPayments, customerPaymentInvoices, purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status, paymentDate, paymentMethod, referenceNo, notes } = await req.json();
  // status: "paid" | "unpaid"
  // paymentMethod: "wire_transfer" | "check" | "cash" | "other"

  if (status === "paid") {
    // Get invoice with PO for clientId and sell price
    const rows = await db
      .select()
      .from(invoices)
      .innerJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .where(eq(invoices.id, Number(id)))
      .limit(1);
    if (!rows.length) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const inv = rows[0].invoices;
    const po = rows[0].purchase_orders;
    const sellPrice = inv.sellPriceOverride ?? po.sellPrice;
    const amount = inv.quantityTons * sellPrice;

    // Create customer payment record
    const [payment] = await db.insert(customerPayments).values({
      clientId: po.clientId,
      paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
      amount,
      paymentMethod: paymentMethod || "wire_transfer",
      referenceNo: referenceNo || null,
      notes: notes || null,
    }).returning();

    // Link payment to invoice
    await db.insert(customerPaymentInvoices).values({
      paymentId: payment.id,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount,
    });
  }

  // Update invoice payment status
  await db.update(invoices)
    .set({ customerPaymentStatus: status, updatedAt: new Date().toISOString() })
    .where(eq(invoices.id, Number(id)));

  revalidatePath("/invoices");
  return NextResponse.json({ ok: true });
}
