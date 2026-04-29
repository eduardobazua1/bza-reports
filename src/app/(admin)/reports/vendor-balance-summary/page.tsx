import { getSupplierPaymentsWithInfo } from "@/server/queries";
import { ReportWrapper } from "@/components/reports/report-wrapper";

export default async function VendorBalanceSummaryPage() {
  const payments = await getSupplierPaymentsWithInfo();

  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const bySupplier: Record<string, { name: string; count: number; total: number; last: string | null }> = {};

  for (const p of payments) {
    const key = String(p.supplierId ?? "unknown");
    if (!bySupplier[key]) {
      bySupplier[key] = { name: p.supplierName || "Unknown", count: 0, total: 0, last: null };
    }
    bySupplier[key].count += 1;
    bySupplier[key].total += p.amountUsd ?? 0;
    if (p.paymentDate && (!bySupplier[key].last || p.paymentDate > bySupplier[key].last!)) {
      bySupplier[key].last = p.paymentDate;
    }
  }

  const rows = Object.values(bySupplier)
    .sort((a, b) => b.total - a.total)
    .map((s) => ({
      supplier:        s.name,
      paymentCount:    s.count,
      totalPaid:       s.total,
      avgPayment:      s.count > 0 ? s.total / s.count : 0,
      lastPaymentDate: s.last as string | null,
    }));

  const grandTotal = rows.reduce((s, r) => s + r.totalPaid, 0);
  const grandCount = rows.reduce((s, r) => s + r.paymentCount, 0);

  const columns = [
    { key: "supplier",        label: "Supplier",      align: "left"  as const, format: "text"     as const },
    { key: "paymentCount",    label: "# Payments",    align: "right" as const, format: "text"     as const },
    { key: "totalPaid",       label: "Total Paid",    align: "right" as const, format: "currency" as const },
    { key: "avgPayment",      label: "Avg Payment",   align: "right" as const, format: "currency" as const },
    { key: "lastPaymentDate", label: "Last Payment",  align: "right" as const, format: "date"     as const },
  ];

  const totals = {
    paymentCount: grandCount,
    totalPaid:    grandTotal,
    avgPayment:   grandCount > 0 ? grandTotal / grandCount : 0,
  };

  return (
    <ReportWrapper
      reportId="vendor-balance-summary"
      title="Vendor Balance Summary"
      subtitle="BZA International Services"
      dateLabel={`As of ${asOf}`}
      columns={columns}
      rows={rows}
      totals={totals}
      totalsLabel="TOTAL"
    />
  );
}
