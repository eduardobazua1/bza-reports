import { getDashboardKPIs } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage() {
  const kpis = await getDashboardKPIs();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const { accountsReceivable, accountsPayable, grossProfit } = kpis;

  const totalAssets = accountsReceivable;
  const totalLiabilities = accountsPayable;
  const totalEquity = grossProfit;
  const totalLiabilitiesEquity = accountsPayable + grossProfit;

  function ValueCell({ value }: { value: number }) {
    return (
      <td className={`px-6 py-3 text-right text-sm ${value < 0 ? "text-red-600" : "text-stone-700"}`}>
        {formatCurrency(value)}
      </td>
    );
  }

  function BoldValueCell({ value }: { value: number }) {
    return (
      <td className={`px-6 py-3 text-right text-sm font-bold ${value < 0 ? "text-red-600" : "text-stone-900"}`}>
        {formatCurrency(value)}
      </td>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
      </div>

      {/* Report card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Report title */}
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">Balance Sheet (Summary)</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        <div className="divide-y divide-stone-100">

          {/* ASSETS */}
          <div>
            <div className="px-6 py-3 bg-stone-50">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Assets</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="hover:bg-stone-50">
                  <td className="px-6 py-3 text-stone-600">Accounts Receivable</td>
                  <ValueCell value={accountsReceivable} />
                </tr>
                <tr className="border-t border-stone-100 bg-stone-50/50">
                  <td className="px-6 py-3 font-bold text-stone-800">Total Current Assets</td>
                  <BoldValueCell value={totalAssets} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* LIABILITIES */}
          <div>
            <div className="px-6 py-3 bg-stone-50">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Liabilities</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="hover:bg-stone-50">
                  <td className="px-6 py-3 text-stone-600">Accounts Payable</td>
                  <ValueCell value={accountsPayable} />
                </tr>
                <tr className="border-t border-stone-100 bg-stone-50/50">
                  <td className="px-6 py-3 font-bold text-stone-800">Total Current Liabilities</td>
                  <BoldValueCell value={totalLiabilities} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* EQUITY */}
          <div>
            <div className="px-6 py-3 bg-stone-50">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Equity</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="hover:bg-stone-50">
                  <td className="px-6 py-3 text-stone-600">Retained Earnings (Gross Profit)</td>
                  <ValueCell value={grossProfit} />
                </tr>
                <tr className="border-t border-stone-100 bg-stone-50/50">
                  <td className="px-6 py-3 font-bold text-stone-800">Total Equity</td>
                  <BoldValueCell value={totalEquity} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* SUMMARY ROW */}
          <div className="bg-[#0d3d3b]/5">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="px-6 py-4 font-bold text-stone-900 text-base">Total Liabilities + Equity</td>
                  <td className={`px-6 py-4 text-right font-bold text-base ${totalLiabilitiesEquity < 0 ? "text-red-600" : "text-stone-900"}`}>
                    {formatCurrency(totalLiabilitiesEquity)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 pb-4 text-sm text-stone-500">Total Assets</td>
                  <td className={`px-6 pb-4 text-right text-sm ${totalAssets < 0 ? "text-red-500" : "text-stone-500"}`}>
                    {formatCurrency(totalAssets)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* Footer note */}
        <div className="px-6 py-4 border-t border-stone-100 space-y-1">
          <p className="text-xs text-stone-400 italic">
            *Simplified operational balance sheet based on trade data. Consult your accountant for full GAAP reporting.
          </p>
          <p className="text-xs text-stone-400">
            {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </div>
  );
}
