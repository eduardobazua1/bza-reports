import { db } from "@/db";
import { marketPrices } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const prices = await db
    .select()
    .from(marketPrices)
    .orderBy(desc(marketPrices.month), marketPrices.source, marketPrices.grade);
  return NextResponse.json(prices);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { source, grade, region, month, price, priceType } = body;

  if (!source || !grade || !region || !month || price == null || !priceType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Upsert: delete existing + insert
  await db.delete(marketPrices).where(
    and(
      eq(marketPrices.source, source),
      eq(marketPrices.grade, grade),
      eq(marketPrices.region, region),
      eq(marketPrices.month, month),
      eq(marketPrices.priceType, priceType),
    )
  );

  const [inserted] = await db.insert(marketPrices).values({
    source,
    grade,
    region,
    month,
    price: parseFloat(price),
    priceType,
  }).returning();

  return NextResponse.json(inserted);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.delete(marketPrices).where(eq(marketPrices.id, id));
  return NextResponse.json({ ok: true });
}
