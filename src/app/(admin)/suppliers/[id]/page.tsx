export const dynamic = "force-dynamic";

import { db } from "@/db";
import { suppliers, supplierPayments, purchaseOrders, invoices, clients } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { SupplierDetailEdit } from "@/components/supplier-detail-edit";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-stone-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-stone-800">{value}</span>
    </div>
  );
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, Number(id)) });
  if (!supplier) notFound();

  const pos = await db
    .select({
      po: purchaseOrders,
      clientName: clients.name,
      invoiceCount: count(invoices.id),
      totalTons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    })
    .from(purchaseOrders)
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(invoices, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.supplierId, supplier.id))
    .groupBy(purchaseOrders.id)
    .orderBy(purchaseOrders.poNumber);

  const payments = await db
    .select({ payment: supplierPayments, poNumber: purchaseOrders.poNumber })
    .from(supplierPayments)
    .leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id))
    .where(eq(supplierPayments.supplierId, supplier.id))
    .orderBy(supplierPayments.paymentDate);

  const totalTons = pos.reduce((s, p) => s + (p.totalTons || 0), 0);
  const totalCost = pos.reduce((s, p) => s + (p.totalCost || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.payment.amountUsd, 0);
  const balance = totalCost - totalPaid;

  const addressParts = [supplier.address, supplier.city, supplier.state, supplier.zip, supplier.country].filter(Boolean);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <a href="/suppliers" className="text-xs text-stone-400 hover:text-stone-600">← Suppliers</a>
          <h1 className="text-2xl font-bold mt-1 text-stone-900">{supplier.name}</h1>
          {(supplier.city || supplier.country) && (
            <p className="text-sm text-stone-400 mt-0.5">{[supplier.city, supplier.country].filter(Boolean).join(", ")}</p>
          )}
        </div>
        <SupplierDetailEdit supplier={supplier} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Total Purchases</p>
          <p className="text-xl font-bold text-stone-900">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{formatNumber(totalTons, 0)} TN · {pos.length} POs</p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-xl font-bold text-[#0d9488]">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{payments.length} payment{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className={`bg-white rounded-md shadow-sm p-4 border-l-4 ${balance > 0 ? "border-l-[#0d3d3b]" : balance < 0 ? "border-l-[#0d9488]" : "border-l-stone-200"}`}>
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Open Balance</p>
          <p className={`text-xl font-bold ${balance > 0 ? "text-[#0d3d3b]" : balance < 0 ? "text-[#0d9488]" : "text-stone-400"}`}>{formatCurrency(Math.abs(balance))}</p>
          <p className="text-xs text-stone-400 mt-0.5">{balance > 0 ? "You owe supplier" : balance < 0 ? "Overpaid" : "Settled"}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact */}
        <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Contact</p>
          <InfoRow label="Contact Name" value={supplier.contactName} />
          <InfoRow label="Email" value={supplier.contactEmail} />
          <InfoRow label="Phone" value={supplier.phone} />
          <InfoRow label="Website" value={supplier.website} />
          {addressParts.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-stone-400 uppercase tracking-wide">Address</span>
              <span className="text-sm text-stone-800 leading-snug">{addressParts.join(", ")}</span>
            </div>
          )}
          {supplier.notes && (
            <div className="flex flex-col gap-0.5 pt-2 border-t border-stone-100">
              <span className="text-[10px] text-stone-400 uppercase tracking-wide">Notes</span>
              <span className="text-xs text-stone-600 leading-relaxed">{supplier.notes}</span>
            </div>
          )}
        </div>

        {/* Bank */}
        <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Bank / ACH Info</p>
          {!supplier.bankName && !supplier.bankAccount ? (
            <p className="text-xs text-stone-400 italic">No bank information on file.</p>
          ) : (
            <>
              <InfoRow label="Bank" value={supplier.bankName} />
              <InfoRow label="Beneficiary" value={supplier.bankBeneficiary} />
              <InfoRow label="Account #" value={supplier.bankAccount} />
              <InfoRow label="Routing / ABA" value={supplier.bankRouting} />
              <InfoRow label="SWIFT / BIC" value={supplier.bankSwift} />
              <InfoRow label="Bank Address" value={supplier.bankAddress} />
            </>
          )}
        </div>

        {/* Cert */}
        <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            {supplier.certType === "pefc" ? "PEFC Certification" : "FSC Certification"}
          </p>
          {!supplier.fscLicense && !supplier.pefc ? (
            <p className="text-xs text-stone-400 italic">No certification on file.</p>
          ) : supplier.certType === "pefc" ? (
            <>
              <InfoRow label="PEFC License" value={supplier.pefc} />
              <InfoRow label="Chain of Custody" value={supplier.fscChainOfCustody} />
            </>
          ) : (
            <>
              <InfoRow label="FSC License" value={supplier.fscLicense} />
              <InfoRow label="Chain of Custody" value={supplier.fscChainOfCustody} />
              <InfoRow label="Input Claim" value={supplier.fscInputClaim} />
              <InfoRow label="Output Claim" value={supplier.fscOutputClaim} />
            </>
          )}
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Purchase Orders ({pos.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">PO #</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">Client</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Price/TN</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Tons</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Total Cost</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-xs text-stone-400">No purchase orders.</td></tr>}
              {pos.map(p => (
                <tr key={p.po.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium"><a href={`/purchase-orders/${p.po.id}`} className="text-[#0d3d3b] hover:underline">{p.po.poNumber}</a></td>
                  <td className="px-4 py-2.5 text-stone-600">{p.clientName || "—"}</td>
                  <td className="px-4 py-2.5 text-stone-500 text-xs">{p.po.poDate || "—"}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(p.po.buyPrice)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(p.totalTons, 1)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(p.totalCost)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500">{p.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
            {pos.length > 0 && (
              <tfoot>
                <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200 text-xs">
                  <td className="px-4 py-2.5" colSpan={4}>TOTAL</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(totalTons, 1)}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(totalCost)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Payments Made</h3>
          <p className="text-xs text-stone-400 mt-0.5">{payments.length} payment{payments.length !== 1 ? "s" : ""} · {formatCurrency(totalPaid)} paid</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Amount</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">PO</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">Reference / Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-xs text-stone-400">No payments recorded.</td></tr>}
              {payments.map(p => (
                <tr key={p.payment.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-700">{formatDate(p.payment.paymentDate)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(p.payment.amountUsd)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{p.poNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{p.payment.reference || p.payment.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200 text-xs">
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(totalPaid)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
