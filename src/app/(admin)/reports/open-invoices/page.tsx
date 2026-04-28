import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function OpenInvoicesPage() {
  const invoices = await getUnpaidInvoicesForPayments();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Group by client
  const byClient: Record<string, {
    name: string;
    rows: typeof invoices;
    subtotal: number;
  }> = {};

  for (const inv of invoices) {
    const key = String(inv.clientId ?? "unknown");
    if (!byClient[key]) byClient[key] = { name: inv.clientName ?? "Unknown", rows: [], subtotal: 0 };
    byClient[key].rows.push(inv);
    byClient[key].subtotal += inv.quantityTons * inv.sellPrice;
  }

  const groups = Object.values(byClient).sort((a, b) => a.name.localeCompare(b.name));
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);

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
          <h2 className="text-lg font-bold text-stone-800">Open Invoices</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">PO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Ship Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Due Date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <>
                  {/* Client group header */}
                  <tr key={`group-${group.name}`} className="bg-stone-50 border-t border-stone-200">
                    <td colSpan={5} className="px-6 py-2 text-xs font-bold text-stone-600 uppercase tracking-wide">
                      {group.name}
                    </td>
                  </tr>

                  {/* Invoice rows */}
                  {group.rows.map(inv => (
                    <tr key={inv.id} className="border-b border-stone-50 hover:bg-stone-50">
                      <td className="px-6 py-3 text-stone-600 font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 text-stone-500">{inv.poNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-500">{formatDate(inv.shipmentDate)}</td>
                      <td className="px-4 py-3 text-stone-500">{formatDate(inv.dueDate)}</td>
                      <td className="px-6 py-3 text-right text-stone-700">{formatCurrency(inv.quantityTons * inv.sellPrice)}</td>
                    </tr>
                  ))}

                  {/* Client subtotal */}
                  <tr key={`subtotal-${group.name}`} className="border-b border-stone-200 bg-stone-50">
                    <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                      {group.name} Subtotal
                    </td>
                    <td className="px-6 py-2 text-right font-semibold text-stone-800">{formatCurrency(group.subtotal)}</td>
                  </tr>
                </>
              ))}

              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-stone-400 text-sm">No open invoices found.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50">
                <td colSpan={4} className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">
                  Grand Total ({invoices.length} invoice{invoices.length !== 1 ? "s" : ""})
                </td>
                <td className="px-6 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(grandTotal)}</td>
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
