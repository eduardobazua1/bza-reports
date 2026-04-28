import { getUnpaidSupplierInvoices } from "@/server/queries";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { APAgingDetailClient } from "@/components/reports/ap-aging-detail-client";

export default async function APAgingDetailPage({
  searchParams,
}: {
  searchParams: { bucket?: string; supplier?: string };
}) {
  const invoices = await getUnpaidSupplierInvoices();
  const today = new Date();

  type Row = { date: string | null; num: string; supplier: string; amount: number; daysSince: number };
  const buckets: { key: string; label: string; order: number; rows: Row[] }[] = [
    { key: "over91",  label: "91 and over days",  order: 0, rows: [] },
    { key: "d61_90",  label: "61 - 90 days",      order: 1, rows: [] },
    { key: "d31_60",  label: "31 - 60 days",      order: 2, rows: [] },
    { key: "current", label: "CURRENT (0 - 30)",  order: 3, rows: [] },
  ];

  for (const inv of invoices) {
    const amount = inv.quantityTons * inv.buyPrice + (inv.freightCost ?? 0);
    let daysSince = 0;
    let bucketKey = "current";
    if (inv.shipmentDate) {
      const days = Math.floor((today.getTime() - new Date(inv.shipmentDate).getTime()) / 86400000);
      daysSince = days;
      if (days > 90)      bucketKey = "over91";
      else if (days > 60) bucketKey = "d61_90";
      else if (days > 30) bucketKey = "d31_60";
      else                bucketKey = "current";
    }
    buckets.find(b => b.key === bucketKey)!.rows.push({
      date: inv.shipmentDate,
      num: inv.invoiceNumber,
      supplier: inv.supplierName || "Unknown",
      amount,
      daysSince,
    });
  }
  for (const b of buckets) b.rows.sort((a, z) => (a.date ?? "").localeCompare(z.date ?? ""));

  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const filterBucket = searchParams.bucket;
  const filterSupplier = searchParams.supplier;
  const filteredInvoices = invoices.filter(inv => {
    if (filterSupplier && !(inv.supplierName || "").toLowerCase().includes(filterSupplier.toLowerCase())) return false;
    if (filterBucket) {
      let bk = "current";
      if (inv.shipmentDate) {
        const d = Math.floor((today.getTime() - new Date(inv.shipmentDate).getTime()) / 86400000);
        if (d > 90)      bk = "over91";
        else if (d > 60) bk = "d61_90";
        else if (d > 30) bk = "d31_60";
      }
      if (bk !== filterBucket) return false;
    }
    return true;
  });
  const total = filteredInvoices.reduce((s, inv) => s + inv.quantityTons * inv.buyPrice + (inv.freightCost ?? 0), 0);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
        <Link href="/reports/ap-aging-summary" className="text-sm text-[#0d9488] hover:underline">
          ← Back to summary report
        </Link>
      </div>

      {(filterSupplier || filterBucket) && (
        <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-2">
          <span>Filtered by:</span>
          {filterSupplier && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{filterSupplier}</span>}
          {filterBucket && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{buckets.find(b => b.key === filterBucket)?.label}</span>}
          <Link href="/reports/ap-aging-detail" className="ml-auto text-xs text-stone-400 hover:text-stone-600">Clear filter</Link>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="py-6 text-center border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-800">A/P Aging Detail Report</h2>
          <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
          <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
        </div>
        <APAgingDetailClient buckets={buckets} total={total} filterBucket={filterBucket} filterSupplier={filterSupplier} />
        <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
          {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
