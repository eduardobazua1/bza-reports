import { getUnpaidSupplierInvoices } from "@/server/queries";
import { APAgingSummaryClient } from "@/components/reports/ap-aging-summary-client";
import type { APRow, APTotals } from "@/components/reports/ap-aging-summary-client";

export default async function APAgingSummaryPage() {
  const invoices = await getUnpaidSupplierInvoices();
  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timestamp = today.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const bySupplier: Record<string, APRow> = {};

  for (const inv of invoices) {
    const amount = inv.quantityTons * inv.buyPrice + (inv.freightCost ?? 0);
    const key = String(inv.supplierId ?? "unknown");
    if (!bySupplier[key]) {
      bySupplier[key] = { name: inv.supplierName || "Unknown", current: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };
    }

    let bucket: keyof Omit<APRow, "name" | "total"> = "current";
    if (inv.shipmentDate) {
      const days = Math.floor((today.getTime() - new Date(inv.shipmentDate).getTime()) / 86400000);
      if (days <= 30)      bucket = "current";
      else if (days <= 60) bucket = "d31_60";
      else if (days <= 90) bucket = "d61_90";
      else                 bucket = "d91plus";
    }
    bySupplier[key][bucket] += amount;
    bySupplier[key].total   += amount;
  }

  const rows: APRow[] = Object.values(bySupplier).sort((a, b) => a.name.localeCompare(b.name));
  const totals: APTotals = { current: 0, d31_60: 0, d61_90: 0, d91plus: 0, total: 0 };
  for (const r of rows) {
    totals.current  += r.current;
    totals.d31_60   += r.d31_60;
    totals.d61_90   += r.d61_90;
    totals.d91plus  += r.d91plus;
    totals.total    += r.total;
  }

  return <APAgingSummaryClient rows={rows} totals={totals} asOf={asOf} timestamp={timestamp} />;
}
