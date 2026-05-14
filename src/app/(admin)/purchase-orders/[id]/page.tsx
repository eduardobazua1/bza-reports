export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getPurchaseOrder, getClients, getSuppliers } from "@/server/queries";
import { db } from "@/db";
import { products } from "@/db/schema";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatPercent,
  transportTypeLabels,
} from "@/lib/utils";
import { PODetailActions } from "@/components/po-detail-actions";
import { ClientPOsSection } from "@/components/client-pos-section";
import { SupplierOrdersSection } from "@/components/supplier-orders-section";
import { InvoicesSection } from "@/components/invoices-section";
import { POSupplierPayments } from "@/components/po-supplier-payments";

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
    active: "bg-stone-100 text-[#0d3d3b]",
    completed: "bg-stone-100 text-[#0d3d3b]",
    cancelled: "bg-[#0d3d3b] text-[#0d3d3b]",
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
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-[#0d3d3b] uppercase tracking-wide">FSC</span>
              )}
              {certType === "pefc" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-[#0d3d3b] uppercase tracking-wide">PEFC</span>
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
            <p className={`text-xl font-semibold mt-1 ${totalProfit >= 0 ? "text-[#0d3d3b]" : "text-[#0d3d3b]"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide">Margin</p>
            <p className="text-xl font-semibold text-stone-900 mt-1">{formatPercent(margin)}</p>
          </div>
        </div>
      </div>

      {/* ── Section 4: Supplier Payments ────────────────────── */}
      {po.supplierId && (
        <POSupplierPayments
          purchaseOrderId={po.id}
          supplierId={po.supplierId}
          payments={po.payments}
          totalCost={totalCost}
        />
      )}

      {/* ── Section 5: Supplier Orders ──────────────────────── */}
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

      {/* ── Section 6: Client Orders ────────────────────────── */}
      <ClientPOsSection
        purchaseOrderId={po.id}
        clientPos={po.clientPos}
        poNumber={po.poNumber}
        sellPrice={po.sellPrice}
        poTerms={po.terms}
        product={clientProduct?.name ?? po.product}
        products={productsList}
        invoices={po.invoices.map(inv => ({ invoiceNumber: inv.invoiceNumber, salesDocument: inv.salesDocument ?? null, quantityTons: inv.quantityTons, clientPoId: inv.clientPoId ?? null }))}
      />

      {/* ── Section 7: Invoices ─────────────────────────────── */}
      <InvoicesSection
        invoices={po.invoices as any}
        poSellPrice={po.sellPrice}
        poBuyPrice={po.buyPrice}
        products={productsList}
        clientTermsDays={po.client?.paymentTermsDays ?? 60}
        clientEmail={po.client?.contactEmail ?? null}
      />

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
