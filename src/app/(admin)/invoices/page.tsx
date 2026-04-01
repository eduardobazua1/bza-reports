import Link from "next/link";
import { getInvoices } from "@/server/queries";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  shipmentStatusLabels,
  shipmentStatusColors,
  paymentStatusLabels,
  paymentStatusColors,
} from "@/lib/utils";
import { InvoiceListActions } from "@/components/invoice-list-actions";

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

  // Counts for tabs
  const totalCount = allInvoices.length;
  const unpaidCount = allInvoices.filter((r) => r.invoice.customerPaymentStatus === "unpaid").length;
  const paidCount = allInvoices.filter((r) => r.invoice.customerPaymentStatus === "paid").length;
  const counts: Record<string, number> = { "": totalCount, unpaid: unpaidCount, paid: paidCount };

  // Filter by payment status
  let invoiceRows = allInvoices;
  if (filterStatus === "unpaid") {
    invoiceRows = invoiceRows.filter((r) => r.invoice.customerPaymentStatus === "unpaid");
  } else if (filterStatus === "paid") {
    invoiceRows = invoiceRows.filter((r) => r.invoice.customerPaymentStatus === "paid");
  }

  // Filter by destination (from map click)
  if (filterDest) {
    invoiceRows = invoiceRows.filter((r) => (r.terms || "").includes(filterDest));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoices{filterDest ? ` — ${filterDest}` : ""}</h1>

      {/* Destination filter banner */}
      {filterDest && (
        <div className="flex items-center gap-3 bg-white rounded-md shadow-sm border-l-[3px] border-l-blue-500 px-4 py-2">
          <span className="text-sm text-stone-600">Filtered by destination: <strong>{filterDest}</strong> ({invoiceRows.length} invoices)</span>
          <Link href="/invoices" className="text-xs text-primary hover:underline">Clear filter</Link>
        </div>
      )}

      {/* Status tabs */}
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

      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">PO #</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Destination</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tons</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Revenue</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Ship Date</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Due Date</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">Days</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Shipment</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Payment</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoiceRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              )}
              {invoiceRows.map((row) => {
                const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
                const revenue = row.invoice.quantityTons * sellPrice;
                const dueDate = row.invoice.dueDate;
                const today = new Date();
                let daysOverdue = 0;
                if (dueDate) {
                  daysOverdue = Math.floor((today.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
                }
                const isOverdue = dueDate && daysOverdue > 0 && row.invoice.customerPaymentStatus === "unpaid";

                return (
                  <tr key={row.invoice.id} className={`hover:bg-muted/50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}>
                    <td className="p-3 text-sm border-t border-border font-medium">
                      {row.invoice.invoiceNumber}
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      <Link href={`/purchase-orders/${row.invoice.purchaseOrderId}`} className="text-primary hover:underline">
                        {row.poNumber || "-"}
                      </Link>
                    </td>
                    <td className="p-3 text-sm border-t border-border">{row.clientName || "-"}</td>
                    <td className="p-3 text-sm border-t border-border text-stone-500">{(row.invoice as any).destination || "-"}</td>
                    <td className="p-3 text-sm border-t border-border text-right">
                      {formatNumber(row.invoice.quantityTons, 2)}
                    </td>
                    <td className="p-3 text-sm border-t border-border text-right font-medium">
                      {formatCurrency(revenue)}
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      {formatDate(row.invoice.shipmentDate)}
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      {dueDate ? formatDate(dueDate) : "-"}
                    </td>
                    <td className="p-3 text-sm border-t border-border text-center">
                      {dueDate && row.invoice.customerPaymentStatus === "unpaid" ? (
                        daysOverdue > 0 ? (
                          <span className="text-red-600 font-bold">+{daysOverdue}d</span>
                        ) : (
                          <span className="text-green-600">{Math.abs(daysOverdue)}d</span>
                        )
                      ) : row.invoice.customerPaymentStatus === "paid" ? (
                        <span className="text-green-600">✓</span>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${shipmentStatusColors[row.invoice.shipmentStatus] || ""}`}>
                        {shipmentStatusLabels[row.invoice.shipmentStatus] || row.invoice.shipmentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${paymentStatusColors[row.invoice.customerPaymentStatus] || ""}`}>
                        {paymentStatusLabels[row.invoice.customerPaymentStatus] || row.invoice.customerPaymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm border-t border-border text-right">
                      <InvoiceListActions invoice={row.invoice} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
