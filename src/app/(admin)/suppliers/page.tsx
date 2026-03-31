import { getSuppliers } from "@/server/queries";
import { SupplierActions } from "@/components/supplier-actions";
import { db } from "@/db";
import { supplierPayments, purchaseOrders, invoices, suppliers as suppliersTable } from "@/db/schema";
import { eq, sql, gte } from "drizzle-orm";

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  // Get balance per supplier — only from X0022 onwards (everything before is settled)
  const costs = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(gte(purchaseOrders.poNumber, "X0022"))
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
    if (c.supplierId) balances.set(Number(c.supplierId), { cost: Number(c.totalCost), paid: 0, balance: Number(c.totalCost) });
  }
  for (const p of payments) {
    const key = Number(p.supplierId);
    const existing = balances.get(key) || { cost: 0, paid: 0, balance: 0 };
    existing.paid = Number(p.totalPaid);
    existing.balance = existing.cost - existing.paid;
    balances.set(key, existing);
  }

  const suppliersWithBalance = suppliers.map((s) => ({
    ...s,
    totalCost: balances.get(Number(s.id))?.cost || 0,
    totalPaid: balances.get(Number(s.id))?.paid || 0,
    balance: balances.get(Number(s.id))?.balance || 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Suppliers</h1>
      <SupplierActions suppliers={suppliersWithBalance} />
    </div>
  );
}
