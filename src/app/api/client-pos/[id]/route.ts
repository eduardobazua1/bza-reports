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

  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.clientPoNumber !== undefined) updateData.clientPoNumber = body.clientPoNumber;
  if (body.destination !== undefined) updateData.destination = body.destination || null;
  if (body.plannedTons !== undefined) updateData.plannedTons = body.plannedTons || null;
  if (body.item !== undefined) updateData.item = body.item || null;
  if (body.incoterm !== undefined) updateData.incoterm = body.incoterm || null;
  if (body.sellPriceOverride !== undefined) updateData.sellPriceOverride = body.sellPriceOverride || null;

  await db.update(clientPurchaseOrders).set(updateData).where(eq(clientPurchaseOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
