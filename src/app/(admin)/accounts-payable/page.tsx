export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/db";
import { suppliers, purchaseOrders, invoices, supplierPayments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { formatCurrency } from "@/lib/utils";

export default async function AccountsPayablePage() {
  const sups = await db.select().from(suppliers).orderBy(suppliers.name);

  // A/P basis: shipped cost (invoiced tons × buy price) vs payments recorded.
  // Same basis as the dashboard's Accounts Payable KPI, so the numbers tie out.
  const [costs, paid] = await Promise.all([
    db
      .select({
        supplierId: purchaseOrders.supplierId,
        totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
        tons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`,
      })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .groupBy(purchaseOrders.supplierId),
    db
      .select({
        supplierId: supplierPayments.supplierId,
        totalPaid: sql<number>`coalesce(sum(${supplierPayments.amountUsd}), 0)`,
        n: sql<number>`count(*)`,
      })
      .from(supplierPayments)
      .groupBy(supplierPayments.supplierId),
  ]);

  const rows = sups
    .map((s) => {
      const c = costs.find((x) => x.supplierId === s.id);
      const p = paid.find((x) => x.supplierId === s.id);
      const cost = Number(c?.totalCost ?? 0);
      const paidAmt = Number(p?.totalPaid ?? 0);
      return {
        supplier: s,
        cost,
        tons: Number(c?.tons ?? 0),
        paid: paidAmt,
        payments: Number(p?.n ?? 0),
        balance: cost - paidAmt,
      };
    })
    .filter((r) => r.cost > 0 || r.paid > 0)
    .sort((a, b) => b.balance - a.balance);

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalBalance = totalCost - totalPaid;
  const pct = totalCost > 0 ? Math.min(100, (totalPaid / totalCost) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Accounts Payable</h1>

      {/* Headline */}
      <div className={`bg-white rounded-lg shadow-sm border-l-[5px] ${totalBalance > 0 ? "border-l-stone-500" : "border-l-[#0d3d3b]"} p-5`}>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">Total outstanding</p>
            <p className={`text-4xl font-bold tracking-tight tabular-nums ${totalBalance > 0 ? "text-stone-600" : "text-[#0d3d3b]"}`}>
              {formatCurrency(Math.abs(totalBalance))}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {totalBalance > 0 ? "you owe" : totalBalance < 0 ? "credit in your favor" : "settled"} ·{" "}
              {rows.filter((r) => r.balance > 0).length} supplier{rows.filter((r) => r.balance > 0).length !== 1 ? "s" : ""} with open balance
            </p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p>{formatCurrency(totalCost)} shipped</p>
            <p>{formatCurrency(totalPaid)} paid</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-stone-400 mb-1.5">
            <span>{formatCurrency(totalPaid)} paid of {formatCurrency(totalCost)} shipped</span>
            <span className="font-medium">{Math.round(pct)}%</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#0d3d3b]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Breakdown by supplier */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
          <h2 className="text-sm font-semibold text-stone-800">Breakdown by supplier</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-stone-400">
                <th className="text-left font-semibold px-4 py-2.5">Supplier</th>
                <th className="text-right font-semibold px-4 py-2.5">Total Cost (shipped)</th>
                <th className="text-right font-semibold px-4 py-2.5">Total Paid</th>
                <th className="text-right font-semibold px-4 py-2.5">Balance</th>
                <th className="text-left font-semibold px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.supplier.id} className="border-t border-stone-100 hover:bg-stone-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/suppliers/${r.supplier.id}`} className="text-[#0d3d3b] font-medium hover:underline">
                      {r.supplier.name}
                    </Link>
                    <span className="block text-[10px] text-stone-400">
                      {Math.round(r.tons).toLocaleString("en-US")} TN · {r.payments} payment{r.payments !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">{formatCurrency(r.cost)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">{formatCurrency(r.paid)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.balance > 0 ? "text-stone-600" : "text-[#0d3d3b]"}`}>
                    {formatCurrency(Math.abs(r.balance))}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        r.balance > 0
                          ? "bg-stone-50 text-stone-700"
                          : r.balance < 0
                          ? "bg-stone-50 text-stone-700"
                          : "bg-[#e6f1ee] text-[#0d3d3b]"
                      }`}
                    >
                      {r.balance > 0 ? "⚠ Pending" : r.balance < 0 ? "↑ Credit" : "✓ Settled"}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                <td className="px-4 py-2.5 text-stone-800">Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-800">{formatCurrency(totalCost)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-800">{formatCurrency(totalPaid)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${totalBalance > 0 ? "text-stone-600" : "text-[#0d3d3b]"}`}>
                  {formatCurrency(Math.abs(totalBalance))}
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-400">
        Click a supplier to see its per-PO breakdown and payment history.
      </p>
    </div>
  );
}
