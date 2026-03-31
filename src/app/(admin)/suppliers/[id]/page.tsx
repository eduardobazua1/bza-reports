import { db } from "@/db";
import { suppliers, supplierPayments, purchaseOrders, invoices, clients } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { SupplierPaymentActions } from "@/components/supplier-payment-actions";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, Number(id)) });
  if (!supplier) notFound();

  // Get all POs for this supplier
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

  // Get all payments
  const payments = await db
    .select({
      payment: supplierPayments,
      poNumber: purchaseOrders.poNumber,
    })
    .from(supplierPayments)
    .leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id))
    .where(eq(supplierPayments.supplierId, supplier.id))
    .orderBy(supplierPayments.paymentDate);

  // Calculate totals — only from X0022 onwards for balance (everything before is settled)
  const totalCost = pos.reduce((s, p) => s + (p.totalCost || 0), 0);
  const totalTons = pos.reduce((s, p) => s + (p.totalTons || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.payment.amountUsd, 0);
  // Balance uses only X0022+ costs
  const costFromX0022 = pos.filter(p => p.po.poNumber >= "X0022").reduce((s, p) => s + (p.totalCost || 0), 0);
  const balance = costFromX0022 - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <a href="/suppliers" className="text-sm text-muted-foreground hover:text-foreground">← Suppliers</a>
        <h1 className="text-2xl font-bold mt-2">{supplier.name}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Purchases</p>
          <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-muted-foreground">{formatNumber(totalTons, 0)} TN</p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase">Total Paid</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-muted-foreground">{payments.length} payments</p>
        </div>
        <div className={`bg-card rounded-lg border p-4 ${balance > 0 ? "border-red-200" : "border-green-200"}`}>
          <p className="text-xs text-muted-foreground uppercase">Outstanding Balance</p>
          <p className={`text-xl font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-xs text-muted-foreground">{balance > 0 ? "To pay" : balance < 0 ? "In favor" : "Settled"}</p>
        </div>
        <div className="bg-white rounded-md shadow-sm p-4">
          <p className="text-xs text-muted-foreground uppercase">OCs</p>
          <p className="text-xl font-bold">{pos.length}</p>
          <p className="text-xs text-muted-foreground">purchase orders</p>
        </div>
      </div>

      {/* Payments section */}
      <SupplierPaymentActions
        supplierId={supplier.id}
        supplierName={supplier.name}
        payments={payments.map((p) => ({
          id: p.payment.id,
          amountUsd: p.payment.amountUsd,
          paymentDate: p.payment.paymentDate,
          tons: p.payment.tons,
          pricePerTon: p.payment.pricePerTon,
          estimatedTons: p.payment.estimatedTons,
          actualTons: p.payment.actualTons,
          actualAmount: p.payment.actualAmount,
          adjustmentAmount: p.payment.adjustmentAmount,
          adjustmentStatus: p.payment.adjustmentStatus,
          reference: p.payment.reference,
          notes: p.payment.notes,
          poNumber: p.poNumber,
          invoiceNumber: null,
        }))}
        pos={pos.map((p) => ({
          id: p.po.id,
          poNumber: p.po.poNumber,
          clientName: p.clientName || "",
          totalCost: p.totalCost || 0,
          totalTons: p.totalTons || 0,
        }))}
      />

      {/* POs table */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Purchase Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">PO #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Price/TN</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Tons</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total Cost</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((p) => (
                <tr key={p.po.id} className="border-t border-border">
                  <td className="p-3 font-medium">
                    <a href={`/purchase-orders/${p.po.id}`} className="text-primary hover:underline">{p.po.poNumber}</a>
                  </td>
                  <td className="p-3">{p.clientName}</td>
                  <td className="p-3 text-right">${formatNumber(p.po.buyPrice, 0)}</td>
                  <td className="p-3 text-right">{formatNumber(p.totalTons, 0)}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(p.totalCost)}</td>
                  <td className="p-3 text-right">{p.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold border-t-2 border-border">
                <td className="p-3" colSpan={3}>TOTAL</td>
                <td className="p-3 text-right">{formatNumber(totalTons, 0)}</td>
                <td className="p-3 text-right">{formatCurrency(totalCost)}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
