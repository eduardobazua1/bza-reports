import { getPurchaseOrders } from "@/server/queries";
import { ReportWrapper } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

export default async function OpenPOsByProductPage() {
  const all = await getPurchaseOrders();
  const active = all.filter((r) => r.po.status === "active");

  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const rows = active
    .map((r) => ({
      product:      r.productName ?? "Unknown",
      poNumber:     r.po.poNumber,
      client:       r.clientName ?? "—",
      supplier:     r.supplierName ?? "—",
      plannedTons:  Number(r.po.plannedTons) || 0,
      shippedTons:  Number(r.totalTons) || 0,
      remaining:    (Number(r.po.plannedTons) || 0) - (Number(r.totalTons) || 0),
      terms:        r.po.terms ?? "—",
    }))
    .sort((a, b) => a.product.localeCompare(b.product) || a.poNumber.localeCompare(b.poNumber));

  const totals = {
    plannedTons: rows.reduce((s, r) => s + r.plannedTons, 0),
    shippedTons: rows.reduce((s, r) => s + r.shippedTons, 0),
    remaining:   rows.reduce((s, r) => s + r.remaining,   0),
  };

  const columns = [
    { key: "product",     label: "Product",      align: "left"  as const, format: "text"   as const, defaultVisible: false },
    { key: "poNumber",    label: "PO #",         align: "left"  as const, format: "text"   as const },
    { key: "client",      label: "Client",       align: "left"  as const, format: "text"   as const },
    { key: "supplier",    label: "Supplier",     align: "left"  as const, format: "text"   as const },
    { key: "plannedTons", label: "Planned Tons", align: "right" as const, format: "number" as const },
    { key: "shippedTons", label: "Shipped",      align: "right" as const, format: "number" as const },
    { key: "remaining",   label: "Remaining",    align: "right" as const, format: "number" as const },
    { key: "terms",       label: "Terms",        align: "left"  as const, format: "text"   as const },
  ];

  return (
    <ReportWrapper
      reportId="open-pos-by-product"
      title="Open POs by Product"
      subtitle="BZA International Services"
      dateLabel={`As of ${asOf}`}
      columns={columns}
      rows={rows}
      totals={totals}
      totalsLabel={`TOTAL (${active.length} active PO${active.length !== 1 ? "s" : ""})`}
      groupBy="product"
    />
  );
}
