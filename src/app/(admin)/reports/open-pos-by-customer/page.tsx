import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPurchaseOrders } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";

export default async function OpenPOsByCustomerPage() {
  const all = await getPurchaseOrders();

  // Filter active only
  const active = all.filter((r) => r.po.status === "active");

  // Group by clientName
  const grouped: Record<
    string,
    Array<(typeof active)[number]>
  > = {};
  for (const row of active) {
    const name = row.clientName ?? "Unknown";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(row);
  }

  const clientNames = Object.keys(grouped).sort();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reports
      </Link>

      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Open POs by Customer</h1>
        <span className="text-sm text-gray-500">{active.length} active PO{active.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-6">
        {clientNames.map((client) => {
          const rows = grouped[client];
          const subtotalTons = rows.reduce((s, r) => s + Number(r.totalTons), 0);
          const subtotalPlanned = rows.reduce((s, r) => s + Number(r.po.plannedTons), 0);
          const subtotalRevenue = rows.reduce((s, r) => s + Number(r.totalRevenue), 0);

          return (
            <div key={client} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Client header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-900">{client}</span>
                <span className="text-xs text-gray-500">
                  {rows.length} PO{rows.length !== 1 ? "s" : ""} &middot; Planned{" "}
                  {subtotalPlanned.toLocaleString("en-US", { maximumFractionDigits: 1 })} t &middot; Shipped{" "}
                  {subtotalTons.toLocaleString("en-US", { maximumFractionDigits: 1 })} t &middot;{" "}
                  {formatCurrency(subtotalRevenue)}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">PO #</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Product</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Terms</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Planned Tons</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Shipped Tons</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.po.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-teal-700">{r.po.poNumber}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.po.product}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.po.terms || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {Number(r.po.plannedTons).toLocaleString("en-US", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {Number(r.totalTons).toLocaleString("en-US", { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {clientNames.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">
            No active purchase orders found.
          </div>
        )}
      </div>
    </div>
  );
}
