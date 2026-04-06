import Link from "next/link";
import { getInvoices } from "@/server/queries";
import { InvoicesTable } from "@/components/invoices-table";

const tabs = [
  { key: "", label: "All" },
  { key: "unpaid", label: "Open" },
  { key: "paid", label: "Paid" },
];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; destination?: string }> }) {
  const params = await searchParams;
  const allInvoices = await getInvoices();

  const filterStatus = params.status || "";
  const filterDest = params.destination || "";

  const totalCount = allInvoices.length;
  const unpaidCount = allInvoices.filter((r) => r.invoice.customerPaymentStatus === "unpaid").length;
  const paidCount = allInvoices.filter((r) => r.invoice.customerPaymentStatus === "paid").length;
  const counts: Record<string, number> = { "": totalCount, unpaid: unpaidCount, paid: paidCount };

  let invoiceRows = allInvoices;
  if (filterStatus === "unpaid") {
    invoiceRows = invoiceRows.filter((r) => r.invoice.customerPaymentStatus === "unpaid");
  } else if (filterStatus === "paid") {
    invoiceRows = invoiceRows.filter((r) => r.invoice.customerPaymentStatus === "paid");
  }
  if (filterDest) {
    invoiceRows = invoiceRows.filter((r) => (r.terms || "").includes(filterDest));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoices{filterDest ? ` — ${filterDest}` : ""}</h1>

      {filterDest && (
        <div className="flex items-center gap-3 bg-white rounded-md shadow-sm border-l-[3px] border-l-blue-500 px-4 py-2">
          <span className="text-sm text-stone-600">
            Filtered by destination: <strong>{filterDest}</strong> ({invoiceRows.length} invoices)
          </span>
          <Link href="/invoices" className="text-xs text-primary hover:underline">Clear filter</Link>
        </div>
      )}

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => {
          const isActive = filterStatus === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/invoices?status=${tab.key}` : "/invoices"}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} <span className="text-xs opacity-70">({counts[tab.key]})</span>
            </Link>
          );
        })}
      </div>

      <InvoicesTable rows={invoiceRows as any} />
    </div>
  );
}
