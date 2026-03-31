import { NextRequest, NextResponse } from "next/server";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;
  await db.update(clientPurchaseOrders).set({ status }).where(eq(clientPurchaseOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
