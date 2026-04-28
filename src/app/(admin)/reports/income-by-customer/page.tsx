import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProfitByClient } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";

export default async function IncomeByCustomerPage() {
  const clients = await getProfitByClient();

  // Sort by revenue desc
  const sorted = [...clients].sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = sorted.reduce((sum, c) => sum + c.revenue, 0);
  const maxRevenue = sorted[0]?.revenue ?? 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reports
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Income by Customer</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Tons</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Avg $/Ton</th>
              <th className="px-4 py-3 w-48"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const avgPerTon = c.tons > 0 ? c.revenue / c.tons : 0;
              const barPct = maxRevenue > 0 ? (c.revenue / maxRevenue) * 100 : 0;
              return (
                <tr key={c.client} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-800 font-medium">{c.client}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.tons.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(avgPerTon)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-teal-600 rounded-full"
                        style={{ width: `${barPct.toFixed(1)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <td className="px-4 py-3 text-gray-900">Total</td>
              <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(totalRevenue)}</td>
              <td className="px-4 py-3 text-right text-gray-900">
                {sorted
                  .reduce((s, c) => s + c.tons, 0)
                  .toLocaleString("en-US", { maximumFractionDigits: 1 })}
              </td>
              <td className="px-4 py-3" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
