import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketPrices } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

// GET: most recent available month prices
export async function GET(req: NextRequest) {
  const auth = verifyMobileToken(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find the most recent month that has data
  const latest = await db
    .select({ month: marketPrices.month })
    .from(marketPrices)
    .orderBy(desc(marketPrices.month))
    .limit(1);

  if (latest.length === 0) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return NextResponse.json({ month: currentMonth, prices: [] });
  }

  const month = latest[0].month;
  const prices = await db
    .select()
    .from(marketPrices)
    .where(eq(marketPrices.month, month))
    .orderBy(marketPrices.source, marketPrices.grade);

  return NextResponse.json({ month, prices });
}

// POST: upsert a price for current month
export async function POST(req: NextRequest) {
  const auth = verifyMobileToken(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { source, grade, region, price, priceType, changeValue, month } = body;

  if (!source || !grade || !region || price == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Delete existing entry for same source+grade+region+month
  await db.delete(marketPrices).where(
    and(
      eq(marketPrices.source, source),
      eq(marketPrices.grade, grade),
      eq(marketPrices.region, region),
      eq(marketPrices.month, targetMonth),
    )
  );

  const [inserted] = await db.insert(marketPrices).values({
    source,
    grade,
    region,
    month: targetMonth,
    price: parseFloat(price),
    priceType: priceType || "net",
    changeValue: changeValue != null ? parseFloat(changeValue) : null,
  }).returning();

  return NextResponse.json(inserted);
}
