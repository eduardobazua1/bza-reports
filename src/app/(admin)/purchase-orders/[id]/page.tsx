import { notFound } from "next/navigation";
import Link from "next/link";
import { getPurchaseOrder, getClients, getSuppliers } from "@/server/queries";
import { DocumentUpload } from "@/components/document-upload";
import { db } from "@/db";
import { products } from "@/db/schema";
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
import { ClientPOsSection } from "@/components/client-pos-section";
import { SupplierOrdersSection } from "@/components/supplier-orders-section";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, clients, suppliers, productsList] = await Promise.all([
    getPurchaseOrder(Number(id)),
    getClients(),
    getSuppliers(),
    db.select({ id: products.id, name: products.name, grade: products.grade, fscLicense: products.fscLicense, chainOfCustody: products.chainOfCustody, inputClaim: products.inputClaim, outputClaim: products.outputClaim, pefc: products.pefc }).from(products).orderBy(products.name),
  ]);

  if (!po) notFound();

  // Resolve product names
  const supplierProduct = po.supplierProductId ? productsList.find(p => p.id === po.supplierProductId) : null;
  const clientProduct = po.clientProductId ? productsList.find(p => p.id === po.clientProductId) : null;

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

  const certType = po.certType ?? null;

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

      {/* ── Section 1: General Info ─────────────────────────── */}
      <div className="bg-white rounded-md shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
          {/* Client */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Client</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">{po.client?.name || "—"}</p>
          </div>

          {/* Supplier + cert badge */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Supplier</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-semibold text-stone-800">{po.supplier?.name || "—"}</p>
              {certType === "fsc" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">FSC</span>
              )}
              {certType === "pefc" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">PEFC</span>
              )}
              {!certType && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-400">None</span>
              )}
            </div>
          </div>

          {/* Sell Price */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Sell Price</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">{formatCurrency(po.sellPrice)}</p>
          </div>

          {/* Buy Price */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Buy Price</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">{formatCurrency(po.buyPrice)}</p>
          </div>

          {/* Incoterm */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Incoterm</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">{po.terms || "—"}</p>
          </div>

          {/* Transport */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Transport</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">
              {po.transportType ? transportTypeLabels[po.transportType] || po.transportType : "—"}
            </p>
          </div>

          {/* Date */}
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Date</p>
            <p className="text-sm font-semibold text-stone-800 mt-1">{formatDate(po.poDate)}</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Certifications ───────────────────────── */}
      {certType && (
        <div className="bg-white rounded-md shadow-sm p-5">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">
            {certType === "fsc" ? "FSC Certification" : "PEFC Certification"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            {certType === "pefc" && po.pefc && (
              <InfoItem label="PEFC Number" value={po.pefc} />
            )}
            {certType === "fsc" && po.licenseFsc && (
              <InfoItem label="FSC License" value={po.licenseFsc} />
            )}
            {po.chainOfCustody && (
              <InfoItem label="Chain of Custody" value={po.chainOfCustody} />
            )}
            {po.inputClaim && (
              <InfoItem label="Input Claim" value={po.inputClaim} />
            )}
            {po.outputClaim && (
              <InfoItem label="Output Claim" value={po.outputClaim} />
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Financial Summary ────────────────────── */}
      <div className="bg-white rounded-md shadow-sm p-5">
        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Tons</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatNumber(totalTons, 1)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Revenue</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Cost</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Profit</p>
            <p className={`text-xl font-semibold mt-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Margin</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatPercent(margin)}</p>
          </div>
        </div>
      </div>

      {/* ── Section 4: Supplier Orders ──────────────────────── */}
      <SupplierOrdersSection
        purchaseOrderId={po.id}
        supplierOrders={po.supplierOrders}
        buyPrice={po.buyPrice}
        poTerms={po.terms}
        poNumber={po.poNumber}
        supplierEmail={po.supplier?.contactEmail ?? null}
        supplierName={po.supplier?.name ?? ""}
        product={supplierProduct?.name ?? po.product}
        products={productsList}
      />

      {/* ── Section 5: Client Orders ────────────────────────── */}
      <ClientPOsSection
        purchaseOrderId={po.id}
        clientPos={po.clientPos}
        poNumber={po.poNumber}
        sellPrice={po.sellPrice}
        product={clientProduct?.name ?? po.product}
        products={productsList}
      />

      {/* ── Section 6: Invoices ─────────────────────────────── */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-stone-200">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Invoices ({po.invoices.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Client PO</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Invoice #</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Product</th>
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
                  <td colSpan={13} className="p-6 text-center text-stone-400">
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
                    <td className="px-3 py-2 border-t border-stone-100 font-medium font-mono text-xs">{(inv as any).salesDocument || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      {inv.invoiceNumber.startsWith("PEND-") ? (
                        <span className="text-xs text-amber-500 italic">Pending docs</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                          <a href={`/api/invoice-pdf?invoice=${inv.invoiceNumber}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">PDF</a>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-600 text-xs">{inv.item || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500">{(inv as any).destination || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500 font-mono text-xs">{inv.vehicleId || "—"}</td>
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
                  <td colSpan={5} className="px-3 py-2 border-t border-stone-200 font-semibold">TOTAL</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatNumber(totalTons, 3)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalRevenue)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalCost - totalFreight)}</td>
                  <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">
                    <span className={totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {formatCurrency(totalProfit)}
                    </span>
                  </td>
                  <td colSpan={5} className="px-3 py-2 border-t border-stone-200"></td>
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
        products={productsList}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-sm font-medium text-stone-800 mt-0.5">{value}</p>
    </div>
  );
}
