import { getInvoices } from "@/server/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function InvoiceListPage() {
  const allInvoices = await getInvoices();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const rows = allInvoices.map(inv => ({
    ...inv,
    amount: inv.invoice.quantityTons * (inv.invoice.sellPriceOverride ?? inv.poSellPrice ?? 0),
  }));

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

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
          <h2 className="text-lg font-bold text-stone-800">Invoice List</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf} — {rows.length} invoices</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">PO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Ship Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Tons</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(inv => {
                const isPaid = inv.invoice.customerPaymentStatus === "paid";
                return (
                  <tr key={inv.invoice.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-4 py-3 text-stone-700 font-medium whitespace-nowrap">{inv.invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{inv.poNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{inv.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{inv.supplierName ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{formatDate(inv.invoice.shipmentDate)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {inv.invoice.quantityTons.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-800">{formatCurrency(inv.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isPaid ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-stone-400 text-sm">No invoices found.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">
                  Total ({rows.length} invoice{rows.length !== 1 ? "s" : ""})
                </td>
                <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(totalAmount)}</td>
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
