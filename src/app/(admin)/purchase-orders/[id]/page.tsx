import { notFound } from "next/navigation";
import Link from "next/link";
import { getPurchaseOrder, getClients, getSuppliers } from "@/server/queries";
import { DocumentUpload } from "@/components/document-upload";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatPercent,
  transportTypeLabels,
  shipmentStatusLabels,
  shipmentStatusColors,
  paymentStatusLabels,
  paymentStatusColors,
} from "@/lib/utils";
import { PODetailActions } from "@/components/po-detail-actions";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, clients, suppliers] = await Promise.all([
    getPurchaseOrder(Number(id)),
    getClients(),
    getSuppliers(),
  ]);

  if (!po) notFound();

  // Financial calculations using actual cost per invoice
  const totalTons = po.invoices.reduce((sum, inv) => sum + inv.quantityTons, 0);
  const totalRevenue = po.invoices.reduce((sum, inv) => {
    return sum + inv.quantityTons * (inv.sellPriceOverride ?? po.sellPrice);
  }, 0);
  const totalCost = po.invoices.reduce((sum, inv) => {
    return sum + inv.quantityTons * (inv.buyPriceOverride ?? po.buyPrice) + (inv.freightCost || 0);
  }, 0);
  const totalFreight = po.invoices.reduce((sum, inv) => sum + (inv.freightCost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    completed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const statusLabelsMap: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/purchase-orders" className="text-sm text-stone-400 hover:text-stone-600">
            &larr; Purchase Orders
          </Link>
          <h1 className="text-2xl font-bold mt-1">PO {po.poNumber}</h1>
        </div>
        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusColors[po.status] || ""}`}>
          {statusLabelsMap[po.status] || po.status}
        </span>
      </div>

      {/* PO Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard label="Client" value={po.client?.name || "-"} />
        <InfoCard label="Supplier" value={po.supplier?.name || "-"} />
        <InfoCard label="Product" value={po.product} />
        <InfoCard label="Date" value={formatDate(po.poDate)} />
        <InfoCard label="Client PO" value={po.clientPoNumber || "-"} />
        <InfoCard label="Terms" value={po.terms || "-"} />
        <InfoCard label="Sell Price" value={formatCurrency(po.sellPrice)} />
        <InfoCard label="Buy Price" value={formatCurrency(po.buyPrice)} />
        <InfoCard label="Transport" value={po.transportType ? transportTypeLabels[po.transportType] || po.transportType : "-"} />
      </div>

      {/* Certification Info */}
      {(po.licenseFsc || po.chainOfCustody || po.inputClaim || po.outputClaim) && (
        <div className="bg-white rounded-md shadow-sm p-4">
          <h3 className="text-sm font-semibold text-stone-500 mb-3">FSC Certification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {po.licenseFsc && <InfoItem label="FSC License" value={po.licenseFsc} />}
            {po.chainOfCustody && <InfoItem label="Chain of Custody" value={po.chainOfCustody} />}
            {po.inputClaim && <InfoItem label="Input Claim" value={po.inputClaim} />}
            {po.outputClaim && <InfoItem label="Output Claim" value={po.outputClaim} />}
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="bg-white rounded-md shadow-sm p-4">
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Financial Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Tons</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatNumber(totalTons, 1)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Cost</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Profit</p>
            <p className={`text-xl font-semibold mt-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Margin</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatPercent(margin)}</p>
          </div>
        </div>
      </div>

      {/* Invoices Table — full breakdown per invoice */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-stone-200">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Invoices ({po.invoices.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Invoice #</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Client PO</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Destination</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Vehicle</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Tons</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Revenue</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Cost</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Profit</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Ship Date</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Status</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Payment</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Docs</th>
              </tr>
            </thead>
            <tbody>
              {po.invoices.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-stone-400">
                    No invoices for this PO.
                  </td>
                </tr>
              )}
              {po.invoices.map((inv) => {
                const sellPrice = inv.sellPriceOverride ?? po.sellPrice;
                const buyPrice = inv.buyPriceOverride ?? po.buyPrice;
                const freight = inv.freightCost || 0;
                const revenue = inv.quantityTons * sellPrice;
                const cost = inv.quantityTons * buyPrice + freight;
                const profit = revenue - cost;

                return (
                  <tr key={inv.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2 border-t border-stone-100 font-medium">
                      <div className="flex items-center gap-2">
                        {inv.invoiceNumber}
                        <a href={`/api/invoice-pdf?invoice=${inv.invoiceNumber}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">PDF</a>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-600 font-mono text-xs">{(inv as any).salesDocument || "-"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500">{(inv as any).destination || "-"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500 font-mono text-xs">{inv.vehicleId || "-"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatNumber(inv.quantityTons, 3)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatCurrency(revenue)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatCurrency(inv.quantityTons * buyPrice)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right font-medium">
                      <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {formatCurrency(profit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">{formatDate(inv.shipmentDate)}</td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${shipmentStatusColors[inv.shipmentStatus] || ""}`}>
                        {shipmentStatusLabels[inv.shipmentStatus] || inv.shipmentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColors[inv.customerPaymentStatus] || ""}`}>
                        {paymentStatusLabels[inv.customerPaymentStatus] || inv.customerPaymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <DocumentUpload invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              {po.invoices.length > 0 && (
                <tr className="bg-stone-50 font-medium">
                  <td colSpan={4} className="px-3 py-2 border-t border-stone-200 font-semibold">TOTAL</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatNumber(totalTons, 3)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalRevenue)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalCost - totalFreight)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">
                    <span className={totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(totalProfit)}
                    </span>
                  </td>
                  <td colSpan={4} className="px-3 py-2 border-t border-stone-200"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit PO & Add Invoice */}
      <PODetailActions
        purchaseOrder={po}
        clients={clients}
        suppliers={suppliers}
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-md shadow-sm p-3">
      <p className="text-xs text-stone-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium mt-1">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
