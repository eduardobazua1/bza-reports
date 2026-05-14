import { getInvoices } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "invoiceNumber", label: "Invoice #", align: "left", format: "text" },
  { key: "po", label: "PO", align: "left", format: "text" },
  { key: "clientName", label: "Client", align: "left", format: "text" },
  { key: "supplierName", label: "Supplier", align: "left", format: "text", defaultVisible: false },
  { key: "shipDate", label: "Ship Date", align: "left", format: "date" },
  { key: "invoiceDate", label: "Invoice Date", align: "left", format: "date", defaultVisible: false },
  { key: "dueDate", label: "Due Date", align: "left", format: "date", defaultVisible: false },
  { key: "tons", label: "Tons", align: "right", format: "number" },
  { key: "amount", label: "Amount", align: "right", format: "currency" },
  { key: "status", label: "Status", align: "center", format: "status" },
];

export default async function InvoiceListPage() {
  const allInvoices = await getInvoices();

  const rows = allInvoices.map((inv) => ({
    invoiceNumber: inv.invoice.invoiceNumber,
    po: inv.poNumber ?? "",
    clientName: inv.clientName ?? "",
    supplierName: inv.supplierName ?? "",
    shipDate: inv.invoice.shipmentDate,
    invoiceDate: inv.invoice.invoiceDate,
    dueDate: inv.invoice.dueDate,
    tons: inv.invoice.quantityTons,
    amount: inv.invoice.quantityTons * (inv.invoice.sellPriceOverride ?? inv.poSellPrice ?? 0),
    status: inv.invoice.customerPaymentStatus,
  }));

  const grandTotal = rows.reduce((s, r) => s + (r.amount as number), 0);
  const grandTons = rows.reduce((s, r) => s + (r.tons as number), 0);

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="invoice-list"
      title="Invoice List"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ amount: grandTotal, tons: grandTons }}
      totalsLabel={`TOTAL (${rows.length} invoices)`}
      groupBy="clientName"
    />
  );
}
