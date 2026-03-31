import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientPurchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(clientPurchaseOrders).where(eq(clientPurchaseOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
