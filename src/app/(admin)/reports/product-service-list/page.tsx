import { getProductsWithSales } from "@/server/queries";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProductServiceListPage() {
  const products = await getProductsWithSales();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sorted = [...products].sort((a, b) => a.product.localeCompare(b.product));

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
          <h2 className="text-lg font-bold text-stone-800">Product & Service List</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total Invoices</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Total Tons</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Avg Revenue / Ton</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const avgRevPerTon = p.totalTons > 0 ? p.totalRevenue / p.totalTons : 0;
                const isActive = p.totalRevenue > 0;
                return (
                  <tr key={p.product} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-6 py-3 text-stone-700 font-medium">{p.product}</td>
                    <td className="px-4 py-3 text-stone-500">Service</td>
                    <td className="px-4 py-3 text-right text-stone-600">{p.invoiceCount}</td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {p.totalTons.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {avgRevPerTon > 0
                        ? avgRevPerTon.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
