import { getCustomerPaymentsWithInvoices } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = {
  wire_transfer: "Wire Transfer",
  cv_credit: "CV Credit",
  xepellin: "Xepellin",
  factoraje_bbva: "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other: "Other",
};

const COLUMNS: ColDef[] = [
  { key: "paymentDate", label: "Date", align: "left", format: "date" },
  { key: "clientName", label: "Client", align: "left", format: "text" },
  { key: "amount", label: "Amount", align: "right", format: "currency" },
  { key: "method", label: "Method", align: "left", format: "text" },
  { key: "referenceNo", label: "Reference #", align: "left", format: "text", defaultVisible: false },
  { key: "invoices", label: "Invoices", align: "left", format: "text" },
];

export default async function ReceivedPaymentsPage() {
  const payments = await getCustomerPaymentsWithInvoices();

  const rows = payments.map((p) => ({
    paymentDate: p.paymentDate,
    clientName: p.clientName ?? "",
    amount: p.amount ?? 0,
    method: p.paymentMethod ? (METHOD[p.paymentMethod] ?? p.paymentMethod) : "",
    referenceNo: p.referenceNo ?? "",
    invoices: p.invoices.map((i) => i.invoiceNumber).join(", "),
  }));

  const totalCollected = rows.reduce((s, r) => s + (r.amount as number), 0);

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="received-payments"
      title="Received Payments"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ amount: totalCollected }}
      totalsLabel={`TOTAL (${rows.length} payments)`}
    />
  );
}
