import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { suppliers, purchaseOrders, invoices, supplierPayments } from "@/db/schema";
import { eq, sql, sum } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allSuppliers = await db.select().from(suppliers);

  const costStats = await db
    .select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`sum(coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice}, 0) * ${invoices.quantityTons} + coalesce(${invoices.freightCost}, 0))`,
      totalTons: sum(invoices.quantityTons),
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .groupBy(purchaseOrders.supplierId);

  const payStats = await db
    .select({
      supplierId: supplierPayments.supplierId,
      totalPaid: sum(supplierPayments.amountUsd),
      estimatedTons: sum(supplierPayments.estimatedTons),
    })
    .from(supplierPayments)
    .groupBy(supplierPayments.supplierId);

  const costMap = new Map(costStats.map(s => [s.supplierId, s]));
  const payMap = new Map(payStats.map(s => [s.supplierId, s]));

  return NextResponse.json(allSuppliers.map(s => {
    const cost = costMap.get(s.id);
    const pay = payMap.get(s.id);
    const totalCost = Number(cost?.totalCost) || 0;
    const totalPaid = Number(pay?.totalPaid) || 0;
    return {
      id: s.id,
      name: s.name,
      country: s.country,
      totalCost,
      totalPaid,
      balance: totalCost - totalPaid,
      totalTons: Number(cost?.totalTons) || 0,
      estimatedTons: Number(pay?.estimatedTons) || 0,
    };
  }));
}
