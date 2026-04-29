import { getUnpaidInvoicesForPayments } from "@/server/queries";
import Link from "next/link";
import { ARAgingDetailClient } from "@/components/reports/ar-aging-detail-client";
import { AgingDetailToolbar } from "@/components/reports/aging-detail-toolbar";

export default async function ARAgingDetailPage({
  searchParams,
}: {
  searchParams: { bucket?: string; client?: string };
}) {
  const invoices = await getUnpaidInvoicesForPayments();
  const today = new Date();

  type Row = { date: string | null; num: string; customer: string; dueDate: string | null; amount: number; pastDue: number };
  const buckets: { key: string; label: string; order: number; rows: Row[] }[] = [
    { key: "over91",  label: "91 and over days past due", order: 0, rows: [] },
    { key: "d61_90", label: "61 - 90 days past due",     order: 1, rows: [] },
    { key: "d31_60", label: "31 - 60 days past due",     order: 2, rows: [] },
    { key: "d1_30",  label: "1 - 30 days past due",      order: 3, rows: [] },
    { key: "current",label: "CURRENT",                   order: 4, rows: [] },
  ];

  for (const inv of invoices) {
    const amount = inv.quantityTons * inv.sellPrice;
    let pastDue = 0;
    let bucketKey = "current";
    if (inv.dueDate) {
      const days = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      pastDue = days;
      if (days > 90)      bucketKey = "over91";
      else if (days > 60) bucketKey = "d61_90";
      else if (days > 30) bucketKey = "d31_60";
      else if (days > 0)  bucketKey = "d1_30";
      else                bucketKey = "current";
    }
    buckets.find(b => b.key === bucketKey)!.rows.push({
      date: inv.shipmentDate, num: inv.invoiceNumber,
      customer: inv.clientName || "Unknown", dueDate: inv.dueDate, amount, pastDue,
    });
  }
  for (const b of buckets) b.rows.sort((a, z) => (a.dueDate ?? "").localeCompare(z.dueDate ?? ""));

  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Filter for display
  const filterBucket = searchParams.bucket;
  const filterClient = searchParams.client;
  const filteredInvoices = invoices.filter(inv => {
    if (filterClient && !(inv.clientName || "").toLowerCase().includes(filterClient.toLowerCase())) return false;
    if (filterBucket) {
      let bk = "current";
      if (inv.dueDate) {
        const d = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
        if (d > 90) bk = "over91";
        else if (d > 60) bk = "d61_90";
        else if (d > 30) bk = "d31_60";
        else if (d > 0)  bk = "d1_30";
      }
      if (bk !== filterBucket) return false;
    }
    return true;
  });
  const total = filteredInvoices.reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);

  // Build flat rows for export
  const exportHeaders = ["Date", "Invoice", "Customer", "Due Date", "Amount", "Open Balance", "Past Due"];
  const exportRows = filteredInvoices.map(inv => {
    const amount = inv.quantityTons * inv.sellPrice;
    let pastDue = 0;
    if (inv.dueDate) {
      const d = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      pastDue = d > 0 ? d : 0;
    }
    function fmt(date: string | null) {
      if (!date) return "";
      return new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    }
    return {
      "Date": fmt(inv.shipmentDate),
      "Invoice": inv.invoiceNumber,
      "Customer": inv.clientName || "Unknown",
      "Due Date": fmt(inv.dueDate ?? null),
      "Amount": amount,
      "Open Balance": amount,
      "Past Due": pastDue,
    };
  });

  return (
    <AgingDetailToolbar
      title="A/R Aging Detail Report"
      backHref="/reports/ar-aging-summary"
      backLabel="← Back to summary"
      filename="AR-Aging-Detail"
      emailSubject="A/R Aging Detail Report — BZA International Services"
      headers={exportHeaders}
      rows={exportRows}
    >
      <div className="space-y-4 max-w-5xl">
        {(filterClient || filterBucket) && (
          <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-2">
            <span>Filtered by:</span>
            {filterClient && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{filterClient}</span>}
            {filterBucket && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{buckets.find(b=>b.key===filterBucket)?.label}</span>}
            <Link href="/reports/ar-aging-detail" className="ml-auto text-xs text-stone-400 hover:text-stone-600">Clear filter</Link>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="py-6 text-center border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-800">A/R Aging Detail Report</h2>
            <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
            <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
          </div>
          <ARAgingDetailClient buckets={buckets} total={total} filterBucket={filterBucket} filterClient={filterClient} />
          <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
            {today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </AgingDetailToolbar>
  );
}
