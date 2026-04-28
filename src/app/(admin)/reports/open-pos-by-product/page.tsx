import { getPurchaseOrders } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function OpenPOsByProductPage() {
  const allPOs = await getPurchaseOrders();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const active = allPOs.filter((row) => row.po.status === "active");

  // Group by product
  const grouped: Record<string, typeof active> = {};
  for (const row of active) {
    const key = row.po.product ?? "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const productKeys = Object.keys(grouped).sort();

  return (
    <div className="space-y-4 max-w-5xl">
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
          <h2 className="text-lg font-bold text-stone-800">Open POs by Product</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        {/* Groups */}
        <div>
          {productKeys.length === 0 && (
            <div className="px-6 py-10 text-center text-stone-400 text-sm">No active purchase orders found.</div>
          )}
          {productKeys.map((product, idx) => {
            const rows = grouped[product];
            return (
              <div key={product} className={idx > 0 ? "border-t border-stone-200" : ""}>
                {/* Product header */}
                <div className="px-6 py-3 bg-stone-50 flex items-center gap-3">
                  <span className="text-sm font-bold text-stone-800 uppercase tracking-wide">{product}</span>
                  <span className="text-xs text-stone-400 font-medium">{rows.length} PO{rows.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="text-left px-6 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">PO #</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Client</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Supplier</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Planned Tons</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Shipped</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Remaining</th>
                        <th className="text-right px-6 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Terms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const remaining = (row.po.plannedTons ?? 0) - (row.totalTons ?? 0);
                        return (
                          <tr key={row.po.id} className="border-b border-stone-50 hover:bg-stone-50">
                            <td className="px-6 py-3 text-stone-700 font-medium">{row.po.poNumber}</td>
                            <td className="px-4 py-3 text-stone-600">{row.clientName ?? "—"}</td>
                            <td className="px-4 py-3 text-stone-600">{row.supplierName ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-stone-700">
                              {(row.po.plannedTons ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right text-stone-600">
                              {(row.totalTons ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${remaining < 0 ? "text-red-600" : remaining === 0 ? "text-stone-400" : "text-emerald-600"}`}>
                              {remaining.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-right text-stone-500">{row.po.terms ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
