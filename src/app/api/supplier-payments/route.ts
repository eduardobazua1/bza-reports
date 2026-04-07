import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierPayments } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json();
  const { supplierId, purchaseOrderId, amountUsd, paymentDate, reference, notes } = body;

  if (!supplierId || !amountUsd || !paymentDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [row] = await db
    .insert(supplierPayments)
    .values({
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      amountUsd,
      paymentDate,
      reference: reference || null,
      notes: notes || null,
      adjustmentStatus: "na",
    })
    .returning();

  return NextResponse.json(row);
}
