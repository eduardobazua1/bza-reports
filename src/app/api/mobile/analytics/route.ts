import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { getRevenueByYear, getProfitByClient } from "@/server/queries";
import { db } from "@/db";
import { invoices, purchaseOrders, clients } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const auth = verifyMobileToken(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [byYear, byClient, allInvoices] = await Promise.all([
    getRevenueByYear(),
    getProfitByClient(),
    db.select({
      shipmentDate: invoices.shipmentDate,
      quantityTons: invoices.quantityTons,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
      buyPrice: sql<number>`coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})`,
      freightCost: invoices.freightCost,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id)),
  ]);

  // Revenue by month for current year
  const currentYear = new Date().getFullYear().toString();
  const byMonth: Record<string, { revenue: number; cost: number; tons: number }> = {};
  for (const inv of allInvoices) {
    if (!inv.shipmentDate) continue;
    const d = new Date(inv.shipmentDate);
    if (d.getFullYear().toString() !== currentYear) continue;
    const month = d.toLocaleString("en", { month: "short" });
    if (!byMonth[month]) byMonth[month] = { revenue: 0, cost: 0, tons: 0 };
    byMonth[month].revenue += inv.quantityTons * inv.sellPrice;
    byMonth[month].cost += inv.quantityTons * inv.buyPrice + (inv.freightCost || 0);
    byMonth[month].tons += inv.quantityTons;
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const revenueByMonth = months
    .filter(m => byMonth[m])
    .map(m => ({
      month: m,
      revenue: Math.round(byMonth[m].revenue),
      profit: Math.round(byMonth[m].revenue - byMonth[m].cost),
      tons: Math.round(byMonth[m].tons),
    }));

  return NextResponse.json({
    byYear,
    byClient: byClient.slice(0, 6),
    revenueByMonth,
  });
}
