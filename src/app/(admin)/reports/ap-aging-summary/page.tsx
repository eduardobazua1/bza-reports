import { getUnpaidSupplierInvoices } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

// Map summary bucket keys → detail bucket keys
const BUCKET_MAP: Record<string, string> = {
  current: "current", d31_60: "d31_60", d61_90: "d61_90", d91plus: "over91",
};

export default async function APAgingSummaryPage() {
  const invoices = await getUnpaidSupplierInvoices();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  type Buckets = { current: number; d31_60: number; d61_90: number; d91plus: number; total: number };
  const bySupplier: Record<string, { name: string } & Buckets> = {};

  for (const inv of invoices) {
    const amount = inv.quantityTons * inv.buyPrice + (inv.freightCost ?? 0);
    const key = String(inv.supplierId ?? "unknown");
    if (!bySupplier[key]) bySupplier[key] = { name: inv.supplierName || "Unknown", current: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };

    let bucket: keyof Omit<Buckets, "total"> = "current";
    if (inv.shipmentDate) {
      const days = Math.floor((today.getTime() - new Date(inv.shipmentDate).getTime()) / 86400000);
      if (days <= 30)      bucket = "current";
      else if (days <= 60) bucket = "d31_60";
      else if (days <= 90) bucket = "d61_90";
      else                 bucket = "d91plus";
    }
    bySupplier[key][bucket] += amount;
    bySupplier[key].total   += amount;
  }

  const rows = Object.values(bySupplier).sort((a, b) => a.name.localeCompare(b.name));
  const totals: Buckets = { current: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };
  for (const r of rows) {
    totals.current  += r.current;
    totals.d31_60   += r.d31_60;
    totals.d61_90   += r.d61_90;
    totals.d91plus  += r.d91plus;
    totals.total    += r.total;
  }

  const cols: { key: keyof Omit<Buckets, "total">; label: string }[] = [
    { key: "current", label: "CURRENT"     },
    { key: "d31_60",  label: "31 - 60"     },
    { key: "d61_90",  label: "61 - 90"     },
    { key: "d91plus", label: "91 AND OVER" },
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
        <button className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 print:hidden">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Report */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Report title */}
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">A/P Aging Summary Report</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide w-48"></th>
                {cols.map(c => (
                  <th key={c.key} className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{c.label}</th>
                ))}
                <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.name} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="px-6 py-3 text-stone-700 font-medium">
                    <Link href={`/reports/ap-aging-detail?supplier=${encodeURIComponent(row.name)}`} className="hover:text-[#0d9488] hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  {cols.map(c => (
                    <td key={c.key} className={`px-4 py-3 text-right ${row[c.key] === 0 ? "text-stone-300" : c.key === "d91plus" ? "text-red-600 font-medium" : c.key === "d61_90" ? "text-amber-600" : "text-stone-700"}`}>
                      {row[c.key] === 0 ? "" : (
                        <Link href={`/reports/ap-aging-detail?supplier=${encodeURIComponent(row.name)}&bucket=${BUCKET_MAP[c.key]}`}
                          className="hover:underline hover:opacity-80">
                          {formatCurrency(row[c.key])}
                        </Link>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-3 text-right font-semibold text-stone-800">
                    <Link href={`/reports/ap-aging-detail?supplier=${encodeURIComponent(row.name)}`} className="hover:underline hover:opacity-80">
                      {formatCurrency(row.total)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">TOTAL</td>
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-right font-bold ${totals[c.key] === 0 ? "text-stone-300" : c.key === "d91plus" ? "text-red-700" : "text-stone-800"}`}>
                    {totals[c.key] === 0 ? "" : formatCurrency(totals[c.key])}
                  </td>
                ))}
                <td className="px-6 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(totals.total)}</td>
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
