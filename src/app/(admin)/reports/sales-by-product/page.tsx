import { getProductsWithSales } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesByProductPage() {
  const products = await getProductsWithSales();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sorted = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totals = sorted.reduce(
    (acc, p) => ({
      invoiceCount: acc.invoiceCount + p.invoiceCount,
      totalTons: acc.totalTons + p.totalTons,
      totalRevenue: acc.totalRevenue + p.totalRevenue,
      totalCost: acc.totalCost + p.totalCost,
      grossProfit: acc.grossProfit + (p.totalRevenue - p.totalCost),
    }),
    { invoiceCount: 0, totalTons: 0, totalRevenue: 0, totalCost: 0, grossProfit: 0 }
  );

  const maxRevenue = sorted[0]?.totalRevenue ?? 1;

  function marginColor(margin: number) {
    if (margin >= 20) return "text-emerald-600 font-semibold";
    if (margin >= 10) return "text-amber-600 font-semibold";
    return "text-red-600 font-semibold";
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
      </div>

      {/* Report */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Report title */}
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">Sales by Product</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Product</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Invoices</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total Tons</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Gross Profit</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const grossProfit = p.totalRevenue - p.totalCost;
                const margin = p.totalRevenue > 0 ? (grossProfit / p.totalRevenue) * 100 : 0;
                const barWidth = Math.round((p.totalRevenue / maxRevenue) * 120);
                return (
                  <tr key={p.product} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-6 py-3 text-stone-700 font-medium">
                      <div>{p.product}</div>
                      <div className="mt-1 w-[120px] h-1.5 bg-[#0d3d3b]/10 rounded-full">
                        <div
                          className="h-1.5 bg-[#0d9488] rounded-full"
                          style={{ width: `${barWidth}px` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">{p.invoiceCount}</td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {p.totalTons.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">{formatCurrency(p.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{formatCurrency(p.totalCost)}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{formatCurrency(grossProfit)}</td>
                    <td className={`px-6 py-3 text-right ${marginColor(margin)}`}>{margin.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">TOTAL</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{totals.invoiceCount}</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">
                  {totals.totalTons.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(totals.totalRevenue)}</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(totals.totalCost)}</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(totals.grossProfit)}</td>
                <td className={`px-6 py-3 text-right font-bold ${marginColor(totals.totalRevenue > 0 ? (totals.grossProfit / totals.totalRevenue) * 100 : 0)}`}>
                  {totals.totalRevenue > 0 ? ((totals.grossProfit / totals.totalRevenue) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
