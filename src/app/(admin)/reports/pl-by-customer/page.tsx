import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProfitByClient } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";

export default async function PLByCustomerPage() {
  const clients = await getProfitByClient();

  // Sort by revenue desc
  const sorted = [...clients].sort((a, b) => b.revenue - a.revenue);

  const totals = sorted.reduce(
    (acc, c) => ({
      revenue: acc.revenue + c.revenue,
      cost: acc.cost + c.cost,
      profit: acc.profit + c.profit,
      tons: acc.tons + c.tons,
    }),
    { revenue: 0, cost: 0, profit: 0, tons: 0 }
  );
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  function marginColor(margin: number) {
    if (margin > 20) return "text-green-600";
    if (margin >= 10) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reports
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profit &amp; Loss by Customer</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Gross Profit</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Margin %</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Tons</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.client} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-800 font-medium">{c.client}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.revenue)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.cost)}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    c.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(c.profit)}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${marginColor(c.margin)}`}>
                  {c.margin.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {c.tons.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-4 py-3 text-gray-900">Total</td>
              <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totals.revenue)}</td>
              <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totals.cost)}</td>
              <td
                className={`px-4 py-3 text-right ${
                  totals.profit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {formatCurrency(totals.profit)}
              </td>
              <td className={`px-4 py-3 text-right ${marginColor(totalMargin)}`}>
                {totalMargin.toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-right text-gray-900">
                {totals.tons.toLocaleString("en-US", { maximumFractionDigits: 1 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
