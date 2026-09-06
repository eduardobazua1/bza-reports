import { db } from "@/db";
import { invoices, purchaseOrders, bankTransactions } from "@/db/schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";

export type BudgetLine = "revenue" | "cogs" | "commissions" | "opex_other";
export const BUDGET_LINES: BudgetLine[] = ["revenue", "cogs", "commissions", "opex_other"];

// Monthly actual P&L drivers for a calendar year (months 1-12).
// Revenue/COGS are accrual (from invoices, by shipment_date). Commissions and
// other OpEx are cash (from categorized bank transactions). All positive.
export async function getMonthlyActuals(year: number): Promise<Record<BudgetLine, number[]>> {
  const zero = () => Array(12).fill(0) as number[];
  const out: Record<BudgetLine, number[]> = {
    revenue: zero(), cogs: zero(), commissions: zero(), opex_other: zero(),
  };
  const from = `${year}-01-01`, to = `${year}-12-31`;

  // Invoices → revenue & cogs by shipment month
  const inv = await db
    .select({
      m: sql<number>`cast(substr(${invoices.shipmentDate}, 6, 2) as integer)`,
      revenue: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)`,
      cogs: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(and(gte(invoices.shipmentDate, from), lte(invoices.shipmentDate, to)))
    .groupBy(sql`substr(${invoices.shipmentDate}, 6, 2)`);
  for (const r of inv) {
    const idx = Number(r.m) - 1;
    if (idx >= 0 && idx < 12) { out.revenue[idx] = Number(r.revenue); out.cogs[idx] = Number(r.cogs); }
  }

  // Bank OpEx → commissions vs other, by transaction month
  const bank = await db
    .select({
      m: sql<number>`cast(substr(${bankTransactions.transactionDate}, 6, 2) as integer)`,
      isCommission: sql<number>`case when lower(coalesce(${bankTransactions.subcategory}, '')) like '%comis%' or lower(coalesce(${bankTransactions.subcategory}, '')) like '%commis%' then 1 else 0 end`,
      total: sql<number>`coalesce(sum(${bankTransactions.amount}), 0)`,
    })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.category, "OpEx"), gte(bankTransactions.transactionDate, from), lte(bankTransactions.transactionDate, to)))
    .groupBy(sql`substr(${bankTransactions.transactionDate}, 6, 2)`, sql`case when lower(coalesce(${bankTransactions.subcategory}, '')) like '%comis%' or lower(coalesce(${bankTransactions.subcategory}, '')) like '%commis%' then 1 else 0 end`);
  for (const r of bank) {
    const idx = Number(r.m) - 1;
    if (idx < 0 || idx >= 12) continue;
    const expense = -Number(r.total); // OpEx amounts are negative → positive expense
    if (Number(r.isCommission) === 1) out.commissions[idx] += expense;
    else out.opex_other[idx] += expense;
  }
  return out;
}

// Average of the last `n` closed months (before cutoff) for each line — the
// baseline the growth target multiplies.
export function recentAverage(actuals: Record<BudgetLine, number[]>, cutoffMonth: number, n = 3): Record<BudgetLine, number> {
  const end = Math.max(0, cutoffMonth); // months are 1-based; use indices [end-n, end)
  const start = Math.max(0, end - n);
  const avg = {} as Record<BudgetLine, number>;
  for (const line of BUDGET_LINES) {
    const slice = actuals[line].slice(start, end).filter((v) => v > 0);
    avg[line] = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  }
  return avg;
}
