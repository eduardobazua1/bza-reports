import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof purchaseOrders.$inferInsert> = {};
  if (body.plannedTons !== undefined) updates.plannedTons = Number(body.plannedTons);
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.endDate !== undefined) updates.endDate = body.endDate;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
