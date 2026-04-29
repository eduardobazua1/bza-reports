import { getPurchaseOrders } from "@/server/queries";
import { ReportWrapper } from "@/components/reports/report-wrapper";

export default async function OpenPOsByCustomerPage() {
  const all = await getPurchaseOrders();
  const active = all.filter((r) => r.po.status === "active");

  const today = new Date();
  const asOf = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const rows = active
    .map((r) => ({
      client: r.clientName ?? "Unknown",
      poNumber: r.po.poNumber,
      product: r.po.product ?? "—",
      terms: r.po.terms ?? "—",
      plannedTons: Number(r.po.plannedTons) || 0,
      shippedTons: Number(r.totalTons) || 0,
      invoices: r.invoiceCount,
    }))
    .sort((a, b) => a.client.localeCompare(b.client) || a.poNumber.localeCompare(b.poNumber));

  const totals = {
    plannedTons: rows.reduce((s, r) => s + r.plannedTons, 0),
    shippedTons: rows.reduce((s, r) => s + r.shippedTons, 0),
    invoices: rows.reduce((s, r) => s + r.invoices, 0),
  };

  const columns = [
    { key: "client",      label: "Customer",     align: "left"  as const, format: "text"   as const, defaultVisible: false },
    { key: "poNumber",    label: "PO #",         align: "left"  as const, format: "text"   as const },
    { key: "product",     label: "Product",      align: "left"  as const, format: "text"   as const },
    { key: "terms",       label: "Terms",        align: "left"  as const, format: "text"   as const },
    { key: "plannedTons", label: "Planned Tons", align: "right" as const, format: "number" as const },
    { key: "shippedTons", label: "Shipped Tons", align: "right" as const, format: "number" as const },
    { key: "invoices",    label: "Invoices",     align: "right" as const, format: "text"   as const },
  ];

  return (
    <ReportWrapper
      reportId="open-pos-by-customer"
      title="Open POs by Customer"
      subtitle="BZA International Services"
      dateLabel={`As of ${asOf}`}
      columns={columns}
      rows={rows}
      totals={totals}
      totalsLabel={`TOTAL (${active.length} active PO${active.length !== 1 ? "s" : ""})`}
      groupBy="client"
    />
  );
}
