import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { ARAgingSummaryClient } from "@/components/reports/ar-aging-summary-client";

export const dynamic = "force-dynamic";

export default async function ARAgingSummaryPage() {
  const invoices = await getUnpaidInvoicesForPayments();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timestamp = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  type Buckets = { current: number; d1_30: number; d31_60: number; d61_90: number; d91plus: number; total: number };
  const byClient: Record<string, { name: string } & Buckets> = {};

  for (const inv of invoices) {
    const amount = inv.quantityTons * inv.sellPrice;
    const key = String(inv.clientId ?? "unknown");
    if (!byClient[key]) byClient[key] = { name: inv.clientName || "Unknown", current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };

    let bucket: keyof Omit<Buckets, "total"> = "current";
    if (inv.dueDate) {
      const days = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      if (days <= 0)       bucket = "current";
      else if (days <= 30) bucket = "d1_30";
      else if (days <= 60) bucket = "d31_60";
      else if (days <= 90) bucket = "d61_90";
      else                 bucket = "d91plus";
    }
    byClient[key][bucket] += amount;
    byClient[key].total   += amount;
  }

  const rows = Object.values(byClient).sort((a, b) => a.name.localeCompare(b.name));
  const totals: Buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };
  for (const r of rows) {
    totals.current += r.current; totals.d1_30 += r.d1_30; totals.d31_60 += r.d31_60;
    totals.d61_90  += r.d61_90; totals.d91plus += r.d91plus; totals.total += r.total;
  }

  return <ARAgingSummaryClient rows={rows} totals={totals} asOf={asOf} timestamp={timestamp} />;
}
