import { getPurchaseOrders } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

const COLUMNS: ColDef[] = [
  { key: "supplierName", label: "Supplier", align: "left", format: "text" },
  { key: "poNumber", label: "PO #", align: "left", format: "text" },
  { key: "startDate", label: "Date", align: "left", format: "date" },
  { key: "clientName", label: "Client", align: "left", format: "text" },
  { key: "status", label: "Status", align: "center", format: "status" },
  { key: "totalRevenue", label: "Revenue", align: "right", format: "currency" },
  { key: "totalCost", label: "Cost", align: "right", format: "currency" },
];

export default async function POsByVendorPage() {
  const all = await getPurchaseOrders();

  const rows = all.map((r) => ({
    supplierName: r.supplierName ?? "",
    poNumber: r.po.poNumber,
    startDate: r.po.startDate,
    clientName: r.clientName ?? "",
    status: r.po.status,
    totalRevenue: Number(r.totalRevenue),
    totalCost: Number(r.totalCost),
  }));

  const totalRevenue = rows.reduce((s, r) => s + (r.totalRevenue as number), 0);
  const totalCost = rows.reduce((s, r) => s + (r.totalCost as number), 0);

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="pos-by-vendor"
      title="POs by Vendor"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ totalRevenue, totalCost }}
      totalsLabel={`TOTAL (${rows.length} POs)`}
      groupBy="supplierName"
    />
  );
}
