import { NextResponse } from "next/server";
import { getMonthlyActuals } from "@/lib/budget";

export const dynamic = "force-dynamic";

// GET /api/financial/budget/actuals?year=2026 → monthly actual P&L drivers
export async function GET(req: Request) {
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const actuals = await getMonthlyActuals(year);
  return NextResponse.json({ year, actuals });
}
