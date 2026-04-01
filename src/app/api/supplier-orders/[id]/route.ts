import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(supplierOrders).where(eq(supplierOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
