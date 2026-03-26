import { getSuppliers } from "@/server/queries";
import { SupplierActions } from "@/components/supplier-actions";
import { db } from "@/db";
import { supplierPayments, purchaseOrders, invoices, suppliers as suppliersTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  // Get balance per supplier
  const costs = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .groupBy(purchaseOrders.supplierId);

  const payments = await db
    .select({
      supplierId: supplierPayments.supplierId,
      totalPaid: sql<number>`coalesce(sum(${supplierPayments.amountUsd}), 0)`,
    })
    .from(supplierPayments)
    .groupBy(supplierPayments.supplierId);

  const balances = new Map<number, { cost: number; paid: number; balance: number }>();
  for (const c of costs) {
    if (c.supplierId) balances.set(c.supplierId, { cost: c.totalCost, paid: 0, balance: c.totalCost });
  }
  for (const p of payments) {
    const existing = balances.get(p.supplierId) || { cost: 0, paid: 0, balance: 0 };
    existing.paid = p.totalPaid;
    existing.balance = existing.cost - p.totalPaid;
    balances.set(p.supplierId, existing);
  }

  const suppliersWithBalance = suppliers.map((s) => ({
    ...s,
    totalCost: balances.get(s.id)?.cost || 0,
    totalPaid: balances.get(s.id)?.paid || 0,
    balance: balances.get(s.id)?.balance || 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Suppliers</h1>
      <SupplierActions suppliers={suppliersWithBalance} />
    </div>
  );
}
