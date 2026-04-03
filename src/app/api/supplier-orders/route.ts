import { NextResponse } from "next/server";
import { db } from "@/db";
import { supplierOrders } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json();
  const { purchaseOrderId, orderDate, tons, pricePerTon, incoterm, item, lines, notes } = body;

  const [row] = await db
    .insert(supplierOrders)
    .values({
      purchaseOrderId,
      orderDate: orderDate || null,
      tons,
      pricePerTon: pricePerTon || null,
      incoterm: incoterm || null,
      item: item || null,
      lines: lines ? JSON.stringify(lines) : null,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(row);
}
