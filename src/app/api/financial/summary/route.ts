import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";
import { and, gte, lte, sql } from "drizzle-orm";

/**
 * GET /api/financial/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregates bank transactions by category → subcategory → vendor.
 * Internal Transfers are reported but flagged (they net to ~0 on consolidation).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conds = [];
  if (from) conds.push(gte(bankTransactions.transactionDate, from));
  if (to) conds.push(lte(bankTransactions.transactionDate, to));

  const rows = await db
    .select({
      category: bankTransactions.category,
      subcategory: bankTransactions.subcategory,
      vendorName: bankTransactions.vendorName,
      total: sql<number>`sum(${bankTransactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(bankTransactions)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(bankTransactions.category, bankTransactions.subcategory, bankTransactions.vendorName);

  // Roll up into category → subcategory tree
  const byCategory: Record<string, {
    total: number;
    count: number;
    subcategories: Record<string, { total: number; count: number; vendor: string | null }>;
  }> = {};

  for (const r of rows) {
    const cat = r.category;
    const sub = r.subcategory || "(uncategorized)";
    byCategory[cat] ??= { total: 0, count: 0, subcategories: {} };
    byCategory[cat].total += r.total;
    byCategory[cat].count += r.count;
    byCategory[cat].subcategories[sub] ??= { total: 0, count: 0, vendor: r.vendorName };
    byCategory[cat].subcategories[sub].total += r.total;
    byCategory[cat].subcategories[sub].count += r.count;
  }

  return NextResponse.json({ from, to, byCategory });
}
