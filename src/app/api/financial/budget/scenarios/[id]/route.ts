import { NextResponse } from "next/server";
import { db } from "@/db";
import { budgetScenarios, budgetLines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMonthlyActuals } from "@/lib/budget";

export const dynamic = "force-dynamic";

// GET → scenario + its lines + the year's actuals (for the vs-actual comparison)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  const scn = await db.select().from(budgetScenarios).where(eq(budgetScenarios.id, sid)).limit(1);
  if (!scn.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lines = await db.select().from(budgetLines).where(eq(budgetLines.scenarioId, sid));
  const actuals = await getMonthlyActuals(scn[0].year);
  return NextResponse.json({ scenario: scn[0], lines, actuals });
}

// PUT → save edited line amounts (and optional name). body: { name?, lines: [{line, month, amount}] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  const body = await req.json();
  const now = new Date().toISOString();
  const lines: { line: string; month: number; amount: number }[] = body.lines || [];

  if (lines.length) {
    await db.delete(budgetLines).where(eq(budgetLines.scenarioId, sid));
    await db.insert(budgetLines).values(lines.map((l) => ({
      scenarioId: sid,
      line: (["revenue", "cogs", "commissions", "opex_other"].includes(l.line) ? l.line : "opex_other") as "revenue" | "cogs" | "commissions" | "opex_other",
      month: l.month,
      amount: Math.round(Number(l.amount) || 0),
    })));
  }
  const name = (body.name as string | undefined)?.slice(0, 120);
  await db.update(budgetScenarios).set({ ...(name ? { name } : {}), updatedAt: now }).where(eq(budgetScenarios.id, sid));
  return NextResponse.json({ ok: true });
}

// DELETE
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  await db.delete(budgetLines).where(eq(budgetLines.scenarioId, sid));
  await db.delete(budgetScenarios).where(eq(budgetScenarios.id, sid));
  return NextResponse.json({ ok: true });
}
