import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ARAgingDetailPage() {
  const invoices = await getUnpaidInvoicesForPayments();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  type BucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d91plus";

  function getBucket(dueDate: string | null): { bucket: BucketKey; days: number } {
    if (!dueDate) return { bucket: "current", days: 0 };
    const days = Math.floor((today.getTime() - new Date(dueDate).getTime()) / 86400000);
    if (days <= 0)       return { bucket: "current", days: 0 };
    if (days <= 30)      return { bucket: "d1_30",   days };
    if (days <= 60)      return { bucket: "d31_60",  days };
    if (days <= 90)      return { bucket: "d61_90",  days };
    return                      { bucket: "d91plus",  days };
  }

  const bucketLabel: Record<BucketKey, string> = {
    current: "Current",
    d1_30:   "1–30",
    d31_60:  "31–60",
    d61_90:  "61–90",
    d91plus: "91+",
  };

  const bucketBadge: Record<BucketKey, string> = {
    current: "bg-stone-100 text-stone-600",
    d1_30:   "bg-stone-100 text-stone-600",
    d31_60:  "bg-stone-100 text-stone-600",
    d61_90:  "bg-amber-100 text-amber-700",
    d91plus: "bg-red-100 text-red-700",
  };

  const rows = invoices
    .map(inv => {
      const amount = inv.quantityTons * inv.sellPrice;
      const { bucket, days } = getBucket(inv.dueDate ?? null);
      return { ...inv, amount, bucket, days };
    })
    .sort((a, b) => {
      const nameA = a.clientName ?? "";
      const nameB = b.clientName ?? "";
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return -1;
      if (!b.dueDate) return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
      </div>

      {/* Report card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">A/R Aging Detail</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">PO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Ship Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Days Overdue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Aging Bucket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowBg =
                  row.bucket === "d91plus" ? "bg-red-50"
                  : row.bucket === "d61_90" ? "bg-amber-50"
                  : "";
                return (
                  <tr key={row.id} className={`border-b border-stone-50 hover:bg-stone-50 ${rowBg}`}>
                    <td className="px-4 py-3 text-stone-700 font-medium whitespace-nowrap">{row.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{row.invoiceNumber}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{row.poNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{formatDate(row.shipmentDate)}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-stone-500">
                      {row.days > 0 ? row.days : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-800">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bucketBadge[row.bucket]}`}>
                        {bucketLabel[row.bucket]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">No unpaid invoices found.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">
                  Total ({rows.length} invoice{rows.length !== 1 ? "s" : ""})
                </td>
                <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(grandTotal)}</td>
                <td />
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
