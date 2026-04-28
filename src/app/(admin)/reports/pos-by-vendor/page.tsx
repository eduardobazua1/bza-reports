import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPurchaseOrders } from "@/server/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function POsByVendorPage() {
  const all = await getPurchaseOrders();

  // Group by supplierName
  const grouped: Record<string, Array<(typeof all)[number]>> = {};
  for (const row of all) {
    const name = row.supplierName ?? "Unknown";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(row);
  }

  const vendorNames = Object.keys(grouped).sort();

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      completed: "bg-gray-100 text-gray-600",
      cancelled: "bg-red-100 text-red-600",
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
          map[status] ?? "bg-gray-100 text-gray-500"
        }`}
      >
        {status}
      </span>
    );
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

      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">POs by Vendor</h1>
        <span className="text-sm text-gray-500">{all.length} PO{all.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-6">
        {vendorNames.map((vendor) => {
          const rows = grouped[vendor];
          const subtotalTons = rows.reduce((s, r) => s + Number(r.totalTons), 0);
          const subtotalRevenue = rows.reduce((s, r) => s + Number(r.totalRevenue), 0);

          return (
            <div key={vendor} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Vendor header */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-900">{vendor}</span>
                <span className="text-xs text-gray-500">
                  {rows.length} PO{rows.length !== 1 ? "s" : ""} &middot; Shipped{" "}
                  {subtotalTons.toLocaleString("en-US", { maximumFractionDigits: 1 })} t &middot;{" "}
                  {formatCurrency(subtotalRevenue)}
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">PO #</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Client</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Tons Shipped</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Revenue</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date Range</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dateRange =
                      r.po.startDate || r.po.endDate
                        ? [r.po.startDate, r.po.endDate]
                            .map((d) => (d ? formatDate(d) : "—"))
                            .join(" – ")
                        : "—";
                    return (
                      <tr
                        key={r.po.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-teal-700">{r.po.poNumber}</td>
                        <td className="px-4 py-2.5 text-gray-700">{r.clientName ?? "—"}</td>
                        <td className="px-4 py-2.5">{statusBadge(r.po.status)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {Number(r.totalTons).toLocaleString("en-US", { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {formatCurrency(Number(r.totalRevenue))}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{dateRange}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {vendorNames.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">
            No purchase orders found.
          </div>
        )}
      </div>
    </div>
  );
}
