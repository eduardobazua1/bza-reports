import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "invoiceNumber", label: "Invoice #", align: "left", format: "text" },
  { key: "po", label: "PO", align: "left", format: "text" },
  { key: "clientName", label: "Client", align: "left", format: "text", defaultVisible: false },
  { key: "shipDate", label: "Ship Date", align: "left", format: "date" },
  { key: "dueDate", label: "Due Date", align: "left", format: "date" },
  { key: "tons", label: "Tons", align: "right", format: "number" },
  { key: "amount", label: "Amount", align: "right", format: "currency" },
];

export default async function OpenInvoicesPage() {
  const invoices = await getUnpaidInvoicesForPayments();

  const rows = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    po: inv.poNumber ?? "",
    clientName: inv.clientName ?? "",
    shipDate: inv.shipmentDate,
    dueDate: inv.dueDate,
    tons: inv.quantityTons,
    amount: inv.quantityTons * inv.sellPrice,
  }));

  const grandTotal = rows.reduce((s, r) => s + (r.amount as number), 0);

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="open-invoices"
      title="Open Invoices"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ amount: grandTotal }}
      totalsLabel={`TOTAL (${rows.length} invoices)`}
      groupBy="clientName"
    />
  );
}
