import { getSupplierPaymentsWithInfo } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function VendorBalanceSummaryPage() {
  const payments = await getSupplierPaymentsWithInfo();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  type SupplierRow = {
    name: string;
    paymentCount: number;
    totalPaid: number;
    lastPaymentDate: string | null;
  };

  const bySupplier: Record<string, SupplierRow> = {};

  for (const p of payments) {
    const key = String(p.supplierId ?? "unknown");
    if (!bySupplier[key]) {
      bySupplier[key] = {
        name: p.supplierName || "Unknown",
        paymentCount: 0,
        totalPaid: 0,
        lastPaymentDate: null,
      };
    }
    bySupplier[key].paymentCount += 1;
    bySupplier[key].totalPaid += p.amountUsd ?? 0;
    if (p.paymentDate) {
      if (!bySupplier[key].lastPaymentDate || p.paymentDate > bySupplier[key].lastPaymentDate!) {
        bySupplier[key].lastPaymentDate = p.paymentDate;
      }
    }
  }

  const rows = Object.values(bySupplier).sort((a, b) => b.totalPaid - a.totalPaid);

  const grandTotal = rows.reduce((s, r) => s + r.totalPaid, 0);
  const grandCount = rows.reduce((s, r) => s + r.paymentCount, 0);

  function fmt(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  return (
    <div className="space-y-4 max-w-4xl">
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
          <h2 className="text-lg font-bold text-stone-800">Vendor Balance Summary</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide"># Payments</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total Paid</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Avg Payment</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.name} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="px-6 py-3 text-stone-700 font-medium">
                    <Link href={`/reports/vendor-balance-detail?supplier=${encodeURIComponent(row.name)}`} className="hover:text-[#0d9488] hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600">{row.paymentCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-stone-800">{formatCurrency(row.totalPaid)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">
                    {row.paymentCount > 0 ? formatCurrency(row.totalPaid / row.paymentCount) : "—"}
                  </td>
                  <td className="px-6 py-3 text-right text-stone-600">{fmt(row.lastPaymentDate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">TOTAL</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{grandCount}</td>
                <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(grandTotal)}</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">
                  {grandCount > 0 ? formatCurrency(grandTotal / grandCount) : "—"}
                </td>
                <td className="px-6 py-3" />
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
