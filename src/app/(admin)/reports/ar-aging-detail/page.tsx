import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { ARAgingDetailFullClient } from "@/components/reports/ar-aging-detail-full-client";

export const dynamic = "force-dynamic";

export default async function ARAgingDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; client?: string }>;
}) {
  const { bucket: filterBucket, client: filterClient } = await searchParams;
  const invoices = await getUnpaidInvoicesForPayments();
  const today = new Date();

  type Row = { date: string | null; num: string; customer: string; dueDate: string | null; amount: number; pastDue: number };
  const buckets: { key: string; label: string; order: number; rows: Row[] }[] = [
    { key: "over91",  label: "91 and over days past due", order: 0, rows: [] },
    { key: "d61_90", label: "61 - 90 days past due",     order: 1, rows: [] },
    { key: "d31_60", label: "31 - 60 days past due",     order: 2, rows: [] },
    { key: "d1_30",  label: "1 - 30 days past due",      order: 3, rows: [] },
    { key: "current",label: "Current",                   order: 4, rows: [] },
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

  const total = invoices
    .filter(inv => {
      if (filterClient && !(inv.clientName || "").toLowerCase().includes(filterClient.toLowerCase())) return false;
      if (filterBucket) {
        let bk = "current";
        if (inv.dueDate) {
          const d = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
          if (d > 90) bk = "over91"; else if (d > 60) bk = "d61_90"; else if (d > 30) bk = "d31_60"; else if (d > 0) bk = "d1_30";
        }
        if (bk !== filterBucket) return false;
      }
      return true;
    })
    .reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);

  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timestamp = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <ARAgingDetailFullClient
      buckets={buckets}
      total={total}
      filterBucket={filterBucket}
      filterClient={filterClient}
      asOf={asOf}
      timestamp={timestamp}
    />
  );
}
