import { db } from "@/db";
import { suppliers, supplierPayments, purchaseOrders, invoices, clients } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, Number(id)) });
  if (!supplier) notFound();

  // All POs for this supplier
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

  // Payments
  const payments = await db
    .select({ payment: supplierPayments, poNumber: purchaseOrders.poNumber })
    .from(supplierPayments)
    .leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id))
    .where(eq(supplierPayments.supplierId, supplier.id))
    .orderBy(supplierPayments.paymentDate);

  const totalTons = pos.reduce((s, p) => s + (p.totalTons || 0), 0);
  const totalCost = pos.reduce((s, p) => s + (p.totalCost || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.payment.amountUsd, 0);
  const costFromX0022 = pos.filter(p => p.po.poNumber >= "X0022").reduce((s, p) => s + (p.totalCost || 0), 0);
  const balance = costFromX0022 - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <a href="/suppliers" className="text-sm text-stone-400 hover:text-stone-600">← Suppliers</a>
        <h1 className="text-2xl font-bold mt-1">{supplier.name}</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Total Compras</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-stone-400">{formatNumber(totalTons, 0)} TN · {pos.length} POs</p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Total Pagado</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-stone-400">{payments.length} pago{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className={`bg-white rounded-md shadow-sm p-4 border-l-4 ${balance > 0 ? "border-l-red-400" : balance < 0 ? "border-l-emerald-400" : "border-l-stone-200"}`}>
          <p className="text-xs text-stone-500 uppercase tracking-wide">Balance (desde X0022)</p>
          <p className={`text-xl font-bold mt-1 ${balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-stone-500"}`}>
            {balance > 0 ? "-" : balance < 0 ? "+" : ""}{formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-xs text-stone-400">
            {balance > 0 ? "Debes pagar" : balance < 0 ? "Te deben" : "Saldado"}
          </p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">FSC License</p>
          <p className="text-sm font-medium mt-1">{supplier.fscLicense || "-"}</p>
          <p className="text-xs text-stone-400">{supplier.fscInputClaim || "-"}</p>
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800">Contratos ({pos.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-stone-500">PO #</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Cliente</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Precio/TN</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Tons</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Costo Total</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Facturas</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.po.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2 font-medium">
                    <a href={`/purchase-orders/${p.po.id}`} className="text-[#0d3d3b] hover:underline">{p.po.poNumber}</a>
                  </td>
                  <td className="px-3 py-2 text-stone-600">{p.clientName || "—"}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(p.po.buyPrice)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(p.totalTons, 1)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.totalCost)}</td>
                  <td className="px-3 py-2 text-right">{p.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2 text-right">{formatNumber(totalTons, 1)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(totalCost)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Pagos Realizados */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-800">Pagos Realizados</h3>
            <p className="text-xs text-stone-400 mt-0.5">{payments.length} pago{payments.length !== 1 ? "s" : ""} · Total pagado: {formatCurrency(totalPaid)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Fecha</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Monto</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">PO</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Referencia / Notas</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-stone-400">Sin pagos registrados.</td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.payment.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-700">{formatDate(p.payment.paymentDate)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCurrency(p.payment.amountUsd)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{p.poNumber || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{p.payment.reference || p.payment.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                  <td className="px-4 py-2.5 text-stone-700">TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-stone-900">{formatCurrency(totalPaid)}</td>
                  <td colSpan={2} className="px-4 py-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
