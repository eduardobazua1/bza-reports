import { getUnpaidSupplierInvoices } from "@/server/queries";
import { APAgingDetailFullClient } from "@/components/reports/ap-aging-detail-full-client";

export const dynamic = "force-dynamic";

export default async function APAgingDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; supplier?: string }>;
}) {
  const { bucket: filterBucket, supplier: filterSupplier } = await searchParams;
  const invoices = await getUnpaidSupplierInvoices();
  const today = new Date();

  type Row = { date: string | null; num: string; supplier: string; amount: number; daysSince: number };
  const buckets: { key: string; label: string; order: number; rows: Row[] }[] = [
    { key: "over91",  label: "91 and over days",  order: 0, rows: [] },
    { key: "d61_90",  label: "61 - 90 days",       order: 1, rows: [] },
    { key: "d31_60",  label: "31 - 60 days",       order: 2, rows: [] },
    { key: "current", label: "CURRENT (0 - 30)",   order: 3, rows: [] },
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

  const total = invoices
    .filter(inv => {
      if (filterSupplier && !(inv.supplierName || "").toLowerCase().includes(filterSupplier.toLowerCase())) return false;
      if (filterBucket) {
        let bk = "current";
        if (inv.shipmentDate) {
          const d = Math.floor((today.getTime() - new Date(inv.shipmentDate).getTime()) / 86400000);
          if (d > 90) bk = "over91"; else if (d > 60) bk = "d61_90"; else if (d > 30) bk = "d31_60";
        }
        if (bk !== filterBucket) return false;
      }
      return true;
    })
    .reduce((s, inv) => s + inv.quantityTons * inv.buyPrice + (inv.freightCost ?? 0), 0);

  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timestamp = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <APAgingDetailFullClient
      buckets={buckets}
      total={total}
      filterBucket={filterBucket}
      filterSupplier={filterSupplier}
      asOf={asOf}
      timestamp={timestamp}
    />
  );
}
