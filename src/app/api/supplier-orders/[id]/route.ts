import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { supplierOrders } from "@/db/schema";
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
  await db.delete(supplierOrders).where(eq(supplierOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
