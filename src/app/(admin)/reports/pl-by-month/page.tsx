import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInvoices } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";

export default async function PLByMonthPage() {
  const rows = await getInvoices();

  // Group by YYYY-MM
  const byMonth: Record<string, { revenue: number; cost: number }> = {};

  for (const row of rows) {
    const date = row.invoice.shipmentDate;
    if (!date) continue;
    const month = date.slice(0, 7);
    const qty = row.invoice.quantityTons ?? 0;
    const sell = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buy = row.invoice.buyPriceOverride ?? row.poBuyPrice ?? 0;
    if (!byMonth[month]) byMonth[month] = { revenue: 0, cost: 0 };
    byMonth[month].revenue += qty * sell;
    byMonth[month].cost += qty * buy;
  }

  const months = Object.entries(byMonth)
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const totals = months.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      profit: acc.profit + m.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  function formatMonth(ym: string) {
    const [year, mon] = ym.split("-");
    const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
    return d.toLocaleString("en-US", { month: "long", year: "numeric" });
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

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profit &amp; Loss by Month</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Month</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Gross Profit</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-800">{formatMonth(m.month)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(m.revenue)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(m.cost)}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    m.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(m.profit)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${
                    m.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {m.margin.toFixed(1)}%
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
              <td
                className={`px-4 py-3 text-right ${
                  totals.profit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {totalMargin.toFixed(1)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
