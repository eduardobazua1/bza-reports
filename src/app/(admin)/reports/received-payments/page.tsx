import { getCustomerPaymentsWithInvoices } from "@/server/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  wire_transfer:    "Wire Transfer",
  cv_credit:        "CV Credit",
  xepellin:         "Xepellin",
  factoraje_bbva:   "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other:            "Other",
};

export default async function ReceivedPaymentsPage() {
  const payments = await getCustomerPaymentsWithInvoices();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const totalCollected = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

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
          <h2 className="text-lg font-bold text-stone-800">Received Payments</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Client</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Invoices Covered</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 text-stone-700 font-medium whitespace-nowrap">{p.clientName ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium text-stone-800 whitespace-nowrap">{formatCurrency(p.amount ?? 0)}</td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {p.paymentMethod ? (METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod) : "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{p.referenceNo ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {p.invoices.length > 0
                      ? p.invoices.map(i => i.invoiceNumber ?? String(i.invoiceId)).join(", ")
                      : <span className="text-stone-300">—</span>
                    }
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-stone-400 text-sm">No payments recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">
                  Total Collected ({payments.length} payment{payments.length !== 1 ? "s" : ""})
                </td>
                <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(totalCollected)}</td>
                <td colSpan={3} />
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
