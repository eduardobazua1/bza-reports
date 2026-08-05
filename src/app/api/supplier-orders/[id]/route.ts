import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { supplierOrders, supplierOrderSends } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const updated = await db
    .update(supplierOrders)
    .set({
      orderDate: body.orderDate ?? null,
      tons: body.tons,
      pricePerTon: body.pricePerTon ?? null,
      incoterm: body.incoterm ?? null,
      item: body.item ?? null,
      lines: body.lines ? JSON.stringify(body.lines) : null,
      notes: body.notes ?? null,
    })
    .where(eq(supplierOrders.id, Number(id)))
    .returning();
  return NextResponse.json(updated[0]);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const soId = Number(id);
  // Remove dependent send-history rows first — they FK-reference the order,
  // otherwise the delete fails and the order reappears on reload.
  await db.delete(supplierOrderSends).where(eq(supplierOrderSends.supplierOrderId, soId));
  await db.delete(supplierOrders).where(eq(supplierOrders.id, soId));
  return NextResponse.json({ ok: true });
}
