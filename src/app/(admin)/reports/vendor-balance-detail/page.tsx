import { getSupplierPaymentsWithInfo } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VendorBalanceDetailClient } from "@/components/reports/vendor-balance-detail-client";

export default async function VendorBalanceDetailPage({
  searchParams,
}: {
  searchParams: { supplier?: string };
}) {
  const payments = await getSupplierPaymentsWithInfo();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const filterSupplier = searchParams.supplier;

  // Group by supplier
  type Payment = {
    id: number;
    paymentDate: string | null;
    poNumber: string | null;
    amountUsd: number | null;
    estimatedTons: number | null;
    actualTons: number | null;
    adjustmentAmount: number | null;
    adjustmentStatus: string | null;
    paymentMethod: string | null;
    reference: string | null;
  };

  const bySupplier: Record<string, { name: string; payments: Payment[] }> = {};

  for (const p of payments) {
    if (filterSupplier && !(p.supplierName || "").toLowerCase().includes(filterSupplier.toLowerCase())) continue;
    const key = String(p.supplierId ?? "unknown");
    if (!bySupplier[key]) bySupplier[key] = { name: p.supplierName || "Unknown", payments: [] };
    bySupplier[key].payments.push({
      id: p.id,
      paymentDate: p.paymentDate,
      poNumber: p.poNumber ?? null,
      amountUsd: p.amountUsd ?? null,
      estimatedTons: p.estimatedTons ?? null,
      actualTons: p.actualTons ?? null,
      adjustmentAmount: p.adjustmentAmount ?? null,
      adjustmentStatus: p.adjustmentStatus ?? null,
      paymentMethod: p.paymentMethod ?? null,
      reference: p.reference ?? null,
    });
  }

  const supplierGroups = Object.values(bySupplier).sort((a, b) => a.name.localeCompare(b.name));
  const grandTotal = supplierGroups.reduce((s, g) => s + g.payments.reduce((ps, p) => ps + (p.amountUsd ?? 0), 0), 0);

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
        <Link href="/reports/vendor-balance-summary" className="text-sm text-[#0d9488] hover:underline">
          ← Back to summary report
        </Link>
      </div>

      {filterSupplier && (
        <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-2">
          <span>Filtered by:</span>
          <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{filterSupplier}</span>
          <Link href="/reports/vendor-balance-detail" className="ml-auto text-xs text-stone-400 hover:text-stone-600">Clear filter</Link>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">Vendor Balance Detail</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>
        <VendorBalanceDetailClient supplierGroups={supplierGroups} grandTotal={grandTotal} />
        <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
