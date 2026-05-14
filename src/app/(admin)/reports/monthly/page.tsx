export const dynamic = "force-dynamic";

import { getInvoices } from "@/server/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export default async function MonthlyBreakdownPage() {
  const allInvoices = await getInvoices();

  const byMonth: Record<string, { tons: number; revenue: number; cost: number }> = {};

  for (const r of allInvoices) {
    const date = r.invoice.shipmentDate;
    if (!date) continue;
    const ym = date.substring(0, 7);
    const tons = r.invoice.quantityTons;
    const sellPrice = r.invoice.sellPriceOverride ?? r.poSellPrice ?? 0;
    const buyPrice  = r.invoice.buyPriceOverride  ?? r.poBuyPrice  ?? 0;
    const freight   = r.invoice.freightCost || 0;
    if (!byMonth[ym]) byMonth[ym] = { tons: 0, revenue: 0, cost: 0 };
    byMonth[ym].tons    += tons;
    byMonth[ym].revenue += tons * Number(sellPrice);
    byMonth[ym].cost    += tons * Number(buyPrice) + freight;
  }

  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, d]) => ({
      month: ym,
      label: new Date(ym + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      tons: d.tons,
      revenue: d.revenue,
      cost: d.cost,
      profit: d.revenue - d.cost,
      margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
    }));

  const totals = rows.reduce((acc, r) => ({
    tons: acc.tons + r.tons,
    revenue: acc.revenue + r.revenue,
    cost: acc.cost + r.cost,
    profit: acc.profit + r.profit,
  }), { tons: 0, revenue: 0, cost: 0, profit: 0 });

  return (
    <div className="bg-white rounded-md shadow-sm">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-800">Monthly Summary</h2>
          <p className="text-xs text-stone-400 mt-0.5">Volume, revenue, cost and profit by shipment month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Month</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Volume (TN)</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Revenue</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Cost</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Profit</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-5 py-3 font-medium text-stone-800">{r.label}</td>
                  <td className="px-5 py-3 text-right text-stone-600">{formatNumber(r.tons, 1)}</td>
                  <td className="px-5 py-3 text-right text-stone-600">{formatCurrency(r.revenue)}</td>
                  <td className="px-5 py-3 text-right text-stone-500">{formatCurrency(r.cost)}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${r.profit >= 0 ? "text-emerald-600" : "text-[#0d3d3b]"}`}>{formatCurrency(r.profit)}</td>
                  <td className={`px-5 py-3 text-right font-medium ${r.margin >= 10 ? "text-emerald-600" : "text-[#0d3d3b]"}`}>{formatPercent(r.margin)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold text-xs">
                <td className="px-5 py-3 text-stone-700 uppercase tracking-wide">Total</td>
                <td className="px-5 py-3 text-right">{formatNumber(totals.tons, 1)}</td>
                <td className="px-5 py-3 text-right">{formatCurrency(totals.revenue)}</td>
                <td className="px-5 py-3 text-right">{formatCurrency(totals.cost)}</td>
                <td className={`px-5 py-3 text-right ${totals.profit >= 0 ? "text-emerald-600" : "text-[#0d3d3b]"}`}>{formatCurrency(totals.profit)}</td>
                <td className={`px-5 py-3 text-right ${totals.revenue > 0 && (totals.profit / totals.revenue) * 100 >= 10 ? "text-emerald-600" : "text-[#0d3d3b]"}`}>
                  {formatPercent(totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
  );
}
