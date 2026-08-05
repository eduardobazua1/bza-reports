export const dynamic = "force-dynamic";

import { getDashboardKPIs, getInvoices } from "@/server/queries";
import { db } from "@/db";
import { scheduledReports, purchaseOrders, invoices, supplierPayments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCreditInsuranceData } from "@/server/credit-insurance";
import { DashboardApp, type Row } from "@/components/dashboard-app";

function parseDestination(terms: string | null | undefined): string {
  const t = terms || "";
  if (t.includes("El Paso")) return "El Paso";
  if (t.includes("Laredo")) return "Laredo";
  if (t.includes("Eagle Pass")) return "Eagle Pass";
  if (t.includes("Manzanillo")) return "Manzanillo";
  if (t.includes("Veracruz")) return "Veracruz";
  return "";
}

function parseTransport(t: string | null | undefined): Row["transport"] {
  return t === "ffcc" ? "Rail" : t === "ship" ? "Ocean" : t === "truck" ? "Truck" : "Other";
}

export default async function DashboardPage() {
  const [kpis, allInvoices, creditInsurance] = await Promise.all([
    getDashboardKPIs(),
    getInvoices(),
    getCreditInsuranceData(),
  ]);

  // Accounts payable: everything shipped (invoiced cost) vs everything paid, per supplier.
  const [supplierCosts, supplierPaid] = await Promise.all([
    db.select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    }).from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .groupBy(purchaseOrders.supplierId),
    db.select({
      supplierId: supplierPayments.supplierId,
      totalPaid: sql<number>`coalesce(sum(${supplierPayments.amountUsd}), 0)`,
    }).from(supplierPayments).groupBy(supplierPayments.supplierId),
  ]);
  const supplierBalanceNet = supplierCosts.reduce((sum, c) => {
    const paid = supplierPaid.find((p) => p.supplierId === c.supplierId)?.totalPaid ?? 0;
    return sum + (Number(c.totalCost) - Number(paid));
  }, 0);
  const supplierBalance = Math.abs(supplierBalanceNet);

  // Pending scheduled reports
  const pendingSchedules = await db
    .select({ id: scheduledReports.id, sendDate: scheduledReports.sendDate })
    .from(scheduledReports)
    .where(eq(scheduledReports.status, "pending"));
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueReportsCount = pendingSchedules.filter((s) => s.sendDate <= todayStr).length;

  // Serializable per-invoice rows — same data, computed client-side per period.
  const rows: Row[] = allInvoices.map((r) => ({
    id: r.invoice.id,
    invoiceNumber: r.invoice.invoiceNumber ?? "",
    clientName: r.clientName ?? "",
    supplierName: r.supplierName ?? "",
    product: r.product ?? r.invoice.item ?? "",
    transport: parseTransport(r.transportType),
    destination: parseDestination(r.terms),
    tons: r.invoice.quantityTons,
    sellPrice: r.invoice.sellPriceOverride ?? r.poSellPrice ?? 0,
    buyPrice: r.invoice.buyPriceOverride ?? r.poBuyPrice ?? 0,
    freight: r.invoice.freightCost || 0,
    shipmentDate: r.invoice.shipmentDate ?? null,
    shipmentStatus: r.invoice.shipmentStatus ?? "",
    custUnpaid: r.invoice.customerPaymentStatus === "unpaid",
    supUnpaid: r.invoice.supplierPaymentStatus === "unpaid",
    dueDate: r.invoice.dueDate ?? null,
  }));

  return (
    <DashboardApp
      rows={rows}
      supplierBalance={supplierBalance}
      supplierBalanceNet={supplierBalanceNet}
      activePOs={kpis.activePOs}
      creditInsurance={creditInsurance}
      overdueReportsCount={overdueReportsCount}
    />
  );
}
