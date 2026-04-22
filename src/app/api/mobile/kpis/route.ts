import { NextRequest, NextResponse } from "next/server";
import { getDashboardKPIs } from "@/server/queries";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  const auth = verifyMobileToken(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kpis = await getDashboardKPIs();
  return NextResponse.json({
    totalRevenue: kpis.totalRevenue,
    totalCost: kpis.totalCost,
    totalProfit: kpis.grossProfit,
    margin: kpis.grossMargin,
    totalTons: kpis.totalTons,
    activeShipments: kpis.pendingShipments,
    pendingInvoices: kpis.unpaidInvoices,
    suppliersOwed: kpis.accountsPayable,
    accountsReceivable: kpis.accountsReceivable,
    overdueAR: kpis.overdueAR,
    onTimeAR: kpis.onTimeAR,
  });
}
