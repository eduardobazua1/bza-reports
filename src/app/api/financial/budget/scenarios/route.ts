import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgetScenarios, budgetLines } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getMonthlyActuals, recentAverage, BUDGET_LINES, BudgetLine } from "@/lib/budget";

export const dynamic = "force-dynamic";

// GET /api/financial/budget/scenarios → list
export async function GET() {
  const rows = await db.select().from(budgetScenarios).orderBy(desc(budgetScenarios.updatedAt));
  return NextResponse.json(rows);
}

// POST → create a scenario and seed its 12 months.
// body: { name, year, cutoffMonth (0-12), growthTarget }
export async function POST(req: Request) {
  const body = await req.json();
  const year = Number(body.year) || new Date().getFullYear();
  const cutoffMonth = Math.max(0, Math.min(12, Number(body.cutoffMonth) || 0));
  const growthTarget = Number(body.growthTarget) || 1;
  const name = (body.name as string || `Forecast ${year}`).slice(0, 120);
  const now = new Date().toISOString();

  const [scn] = await db.insert(budgetScenarios).values({ name, year, cutoffMonth, growthTarget, createdAt: now, updatedAt: now }).returning();

  // Baseline for forecast months: recent 3 closed months of this year, or (for a
  // pure annual budget) the prior year's monthly average.
  const actuals = await getMonthlyActuals(year);
  let baseline: Record<BudgetLine, number>;
  if (cutoffMonth >= 1) {
    baseline = recentAverage(actuals, cutoffMonth, 3);
  } else {
    const prev = await getMonthlyActuals(year - 1);
    baseline = {} as Record<BudgetLine, number>;
    for (const line of BUDGET_LINES) {
      const active = prev[line].filter((v) => v > 0);
      baseline[line] = active.length ? active.reduce((a, b) => a + b, 0) / active.length : 0;
    }
  }

  const rows: { scenarioId: number; line: BudgetLine; month: number; amount: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    for (const line of BUDGET_LINES) {
      let amount: number;
      if (m <= cutoffMonth) {
        amount = actuals[line][m - 1];                    // locked actual
      } else if (line === "opex_other") {
        amount = baseline.opex_other;                     // fixed overhead — does not scale
      } else {
        amount = baseline[line] * growthTarget;           // revenue/cogs/commissions scale with the target
      }
      rows.push({ scenarioId: scn.id, line, month: m, amount: Math.round(amount) });
    }
  }
  await db.insert(budgetLines).values(rows);
  return NextResponse.json(scn, { status: 201 });
}
