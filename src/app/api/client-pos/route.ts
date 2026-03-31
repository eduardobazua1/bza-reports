import { NextResponse } from "next/server";
import { db } from "@/db";
import { clientPurchaseOrders } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json();
  const { purchaseOrderId, clientPoNumber, destination, plannedTons } = body;

  if (!purchaseOrderId || !clientPoNumber) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [cpo] = await db
    .insert(clientPurchaseOrders)
    .values({ purchaseOrderId, clientPoNumber, destination, plannedTons })
    .returning();

  return NextResponse.json(cpo);
}
