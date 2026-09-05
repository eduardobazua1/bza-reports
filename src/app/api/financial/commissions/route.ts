import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";
import { and, gte, lte, or, like, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/financial/commissions?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Sales-commission payments, bucketed by program/agent (derived from the
 * transaction subcategory), with each program's rate vs the related client sales.
 * A commission is any bank transaction whose subcategory mentions commission
 * ("comis"/"commis"), regardless of category — so we can also surface the ones
 * that are currently mis-filed under Distribution instead of OpEx.
 */

type Program = "Biopappel" | "Sasson" | "Kimberly-Clark" | "Other";

function programOf(sub: string): Program {
  const s = sub.toLowerCase();
  if (s.includes("biopappel") || s.includes("bio pappel")) return "Biopappel";
  if (s.includes("sasson")) return "Sasson";
  if (s.includes("kc") || s.includes("kimberly")) return "Kimberly-Clark";
  return "Other";
}
const AGENT: Record<Program, string> = {
  "Biopappel": "Desarrollos Tecnológicos",
  "Sasson": "Salvador Sasson",
  "Kimberly-Clark": "Luz María Very",
  "Other": "—",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateConds = [];
  if (from) dateConds.push(gte(bankTransactions.transactionDate, from));
  if (to) dateConds.push(lte(bankTransactions.transactionDate, to));

  const isCommission = or(
    like(sql`lower(coalesce(${bankTransactions.subcategory}, ''))`, "%comis%"),
    like(sql`lower(coalesce(${bankTransactions.subcategory}, ''))`, "%commis%"),
  );

  const rows = await db
    .select({
      id: bankTransactions.id,
      date: bankTransactions.transactionDate,
      amount: bankTransactions.amount,
      category: bankTransactions.category,
      subcategory: bankTransactions.subcategory,
      description: bankTransactions.descriptionRaw,
    })
    .from(bankTransactions)
    .where(and(isCommission, ...dateConds))
    .orderBy(bankTransactions.transactionDate);

  // Sales per client (Revenue) for the commission-rate calc.
  const salesRows = await db
    .select({ subcategory: bankTransactions.subcategory, total: sql<number>`sum(${bankTransactions.amount})` })
    .from(bankTransactions)
    .where(and(sql`${bankTransactions.category} = 'Revenue'`, ...dateConds))
    .groupBy(bankTransactions.subcategory);
  const salesByClient = { Biopappel: 0, "Kimberly-Clark": 0 };
  for (const s of salesRows) {
    const sub = (s.subcategory || "").toLowerCase();
    if (sub.includes("biopappel") || sub.includes("bio pappel")) salesByClient.Biopappel += Number(s.total);
    if (sub.includes("kimberly") || sub.includes("kc")) salesByClient["Kimberly-Clark"] += Number(s.total);
  }

  const programs: Record<string, {
    program: Program; agent: string; expense: number; count: number;
    byYear: Record<string, number>;
  }> = {};
  const payments = [];
  const misplaced: { id: number; date: string; amount: number; program: Program; subcategory: string | null }[] = [];
  let totalExpense = 0;

  for (const r of rows) {
    const prog = programOf(r.subcategory || "");
    const amt = Number(r.amount);            // negative = paid out, positive = a return
    const expense = -amt;                    // report commissions as a positive expense
    const yr = r.date.slice(0, 4);
    programs[prog] ??= { program: prog, agent: AGENT[prog], expense: 0, count: 0, byYear: {} };
    programs[prog].expense += expense;
    programs[prog].count += 1;
    programs[prog].byYear[yr] = (programs[prog].byYear[yr] ?? 0) + expense;
    totalExpense += expense;
    payments.push({ id: r.id, date: r.date, amount: amt, program: prog, agent: AGENT[prog], category: r.category, subcategory: r.subcategory, description: r.description });
    // commissions belong in OpEx; flag any that are filed elsewhere
    if (r.category !== "OpEx") misplaced.push({ id: r.id, date: r.date, amount: amt, program: prog, subcategory: r.subcategory });
  }

  const byProgram = Object.values(programs)
    .map((p) => {
      const sales = (salesByClient as Record<string, number>)[p.program] ?? 0;
      return { ...p, sales, rate: sales > 0 ? p.expense / sales : null };
    })
    .sort((a, b) => b.expense - a.expense);

  // overall by-year across all programs
  const byYear: Record<string, number> = {};
  for (const p of byProgram) for (const [yr, v] of Object.entries(p.byYear)) byYear[yr] = (byYear[yr] ?? 0) + v;

  return NextResponse.json({
    from, to, totalExpense, count: rows.length,
    byProgram, byYear,
    misplaced,
    misplacedTotal: misplaced.reduce((s, m) => s + -m.amount, 0),
    payments: payments.sort((a, b) => (a.date < b.date ? 1 : -1)),
  });
}
