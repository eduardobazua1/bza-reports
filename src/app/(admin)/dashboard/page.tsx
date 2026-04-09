export const dynamic = "force-dynamic";

import { getDashboardKPIs, getInvoices } from "@/server/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { DashboardVisuals } from "@/components/dashboard-visuals";
import { ShipmentMap } from "@/components/shipment-map";
import { MarketPricesWidget } from "@/components/market-prices-widget";
import { db } from "@/db";
import { scheduledReports, clients as clientsTable, reportTemplates, marketPrices, supplierPayments, purchaseOrders, invoices } from "@/db/schema";
import { eq, sql, desc, gte } from "drizzle-orm";
import Link from "next/link";
import { KPIBig } from "@/components/kpi-card";

export default async function DashboardPage() {
  const [kpis, allInvoices] = await Promise.all([
    getDashboardKPIs(),
    getInvoices(),
  ]);

  // Supplier balance (from X0022 onwards)
  const [supplierCosts, supplierPaid] = await Promise.all([
    db.select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    }).from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .where(gte(purchaseOrders.poNumber, "X0022"))
      .groupBy(purchaseOrders.supplierId),
    db.select({
      supplierId: supplierPayments.supplierId,
      totalPaid: sql<number>`coalesce(sum(${supplierPayments.amountUsd}), 0)`,
    }).from(supplierPayments).groupBy(supplierPayments.supplierId),
  ]);
  const supplierBalanceNet = supplierCosts.reduce((sum, c) => {
    const paid = supplierPaid.find(p => p.supplierId === c.supplierId)?.totalPaid ?? 0;
    return sum + (Number(c.totalCost) - Number(paid));
  }, 0);
  const supplierBalance = Math.abs(supplierBalanceNet);

  // Market prices for widget
  let allMarketPrices: any[] = [];
  try {
    allMarketPrices = await db.select().from(marketPrices).orderBy(desc(marketPrices.month));
  } catch { /* table may not exist yet */ }

  // Scheduled report reminders
  const pendingSchedules = await db
    .select({
      id: scheduledReports.id, sendDate: scheduledReports.sendDate,
      notes: scheduledReports.notes, clientName: clientsTable.name,
      templateName: reportTemplates.name, clientId: scheduledReports.clientId,
    })
    .from(scheduledReports)
    .leftJoin(clientsTable, eq(scheduledReports.clientId, clientsTable.id))
    .leftJoin(reportTemplates, eq(scheduledReports.templateId, reportTemplates.id))
    .where(eq(scheduledReports.status, "pending"));

  const todayStr = new Date().toISOString().split("T")[0];
  const overdueReports = pendingSchedules.filter((s) => s.sendDate <= todayStr);


  // Build chart data
  const byMonth: Record<string, number> = {};
  const byTransport: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byClient: Record<string, number> = {};
  const bySupplier: Record<string, number> = {};
  const byIncoterm: Record<string, number> = {};
  const marginByYear: Record<string, { revenue: number; cost: number }> = {};
  const marginByMonth: Record<string, { revenue: number; cost: number }> = {};

  let totalPaid = 0;
  let totalUnpaid = 0;
  let deliveredCount = 0;
  let totalCount = allInvoices.length;

  for (const r of allInvoices) {
    const tons = r.invoice.quantityTons;
    // By month
    const date = r.invoice.shipmentDate;
    if (date) {
      const ym = date.substring(0, 7); // YYYY-MM
      byMonth[ym] = (byMonth[ym] || 0) + tons;
    }
    // By transport
    const transport = r.transportType === "ffcc" ? "Rail" : r.transportType === "ship" ? "Ocean" : r.transportType === "truck" ? "Truck" : "Other";
    byTransport[transport] = (byTransport[transport] || 0) + tons;
    // By status
    const status = r.invoice.shipmentStatus === "entregado" ? "Delivered" : r.invoice.shipmentStatus === "en_transito" ? "In Transit" : r.invoice.shipmentStatus === "en_aduana" ? "Customs" : "Scheduled";
    byStatus[status] = (byStatus[status] || 0) + tons;
    // By client
    const client = r.clientName || "Other";
    byClient[client] = (byClient[client] || 0) + tons;
    // By supplier
    const supplier = r.supplierName || "Other";
    bySupplier[supplier] = (bySupplier[supplier] || 0) + tons;
    // By incoterm/destination
    const terms = r.terms || "";
    let dest = "Other";
    if (terms.includes("El Paso")) dest = "El Paso";
    else if (terms.includes("Laredo")) dest = "Laredo";
    else if (terms.includes("Eagle Pass")) dest = "Eagle Pass";
    else if (terms.includes("Manzanillo")) dest = "Manzanillo";
    else if (terms.includes("Veracruz")) dest = "Veracruz";
    byIncoterm[dest] = (byIncoterm[dest] || 0) + tons;
    // Margin by year
    const sellPrice = r.invoice.sellPriceOverride ?? r.poSellPrice ?? 0;
    const buyPrice = r.invoice.buyPriceOverride ?? r.poBuyPrice ?? 0;
    const freight = r.invoice.freightCost || 0;
    const revenue = tons * sellPrice;
    const cost = tons * buyPrice + freight;
    const shipYear = date ? new Date(date).getFullYear().toString() : "N/A";
    const shipMonth = date ? date.substring(0, 7) : "N/A";
    if (!marginByYear[shipYear]) marginByYear[shipYear] = { revenue: 0, cost: 0 };
    marginByYear[shipYear].revenue += revenue;
    marginByYear[shipYear].cost += cost;
    if (!marginByMonth[shipMonth]) marginByMonth[shipMonth] = { revenue: 0, cost: 0 };
    marginByMonth[shipMonth].revenue += revenue;
    marginByMonth[shipMonth].cost += cost;
    // Payment
    if (r.invoice.customerPaymentStatus === "paid") totalPaid++;
    else totalUnpaid++;
    if (r.invoice.shipmentStatus === "entregado") deliveredCount++;
  }

  // Extract location data from terms field
  const byLocation: Record<string, { tons: number; shipments: number }> = {};
  for (const r of allInvoices) {
    const terms = r.terms || "";
    const tons = r.invoice.quantityTons;
    // Parse location from terms like "EXW DAP El Paso, TX", "CIF Manzanillo", "DAP Laredo"
    let loc = "";
    if (terms.includes("El Paso")) loc = "El Paso";
    else if (terms.includes("Laredo")) loc = "Laredo";
    else if (terms.includes("Eagle Pass")) loc = "Eagle Pass";
    else if (terms.includes("Manzanillo")) loc = "Manzanillo";
    else if (terms.includes("Veracruz")) loc = "Veracruz";
    if (loc) {
      if (!byLocation[loc]) byLocation[loc] = { tons: 0, shipments: 0 };
      byLocation[loc].tons += tons;
      byLocation[loc].shipments += 1;
    }
  }
  const locationData = Object.fromEntries(
    Object.entries(byLocation).map(([name, data]) => [name, { name, ...data }])
  );

  // Prepare sorted data for charts
  const volumeByMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, tons]) => ({ month: month.substring(2), tons: Math.round(tons) }));

  const volumeByTransport = Object.entries(byTransport)
    .map(([name, tons]) => ({ name, value: Math.round(tons) }))
    .sort((a, b) => b.value - a.value);

  const volumeByStatus = Object.entries(byStatus)
    .map(([name, tons]) => ({ name, value: Math.round(tons) }));

  const volumeByClient = Object.entries(byClient)
    .map(([name, tons]) => ({ name: name.split(",")[0].split("S.A")[0].trim(), value: Math.round(tons) }))
    .sort((a, b) => b.value - a.value);

  const volumeBySupplier = Object.entries(bySupplier)
    .map(([name, tons]) => ({ name: name.split(",")[0].split("(")[0].trim(), value: Math.round(tons) }))
    .sort((a, b) => b.value - a.value);

  const volumeByIncoterm = Object.entries(byIncoterm)
    .filter(([name]) => name !== "Other")
    .map(([name, tons]) => ({ name, value: Math.round(tons) }))
    .sort((a, b) => b.value - a.value);

  // Recent shipments for table
  const recentShipments = [...allInvoices]
    .filter(r => r.invoice.shipmentDate)
    .sort((a, b) => (b.invoice.shipmentDate ?? "").localeCompare(a.invoice.shipmentDate ?? ""))
    .slice(0, 10)
    .map(r => {
      const terms = r.terms || "";
      let destination = "";
      if (terms.includes("El Paso")) destination = "El Paso";
      else if (terms.includes("Laredo")) destination = "Laredo";
      else if (terms.includes("Eagle Pass")) destination = "Eagle Pass";
      else if (terms.includes("Manzanillo")) destination = "Manzanillo";
      else if (terms.includes("Veracruz")) destination = "Veracruz";
      return {
        invoiceNumber: r.invoice.invoiceNumber ?? "",
        clientName: r.clientName ?? "",
        destination,
        tons: Math.round(r.invoice.quantityTons),
        shipmentDate: r.invoice.shipmentDate ?? null,
        status: r.invoice.shipmentStatus ?? "",
      };
    });

  // KPI gauges
  const deliveryRate = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;
  const collectionRate = totalCount > 0 ? (totalPaid / totalCount) * 100 : 0;

  // Margin by year for display
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().toISOString().substring(0, 7);
  const marginYearData = Object.entries(marginByYear)
    .filter(([y]) => y !== "N/A")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, d]) => ({
      year,
      margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      profit: d.revenue - d.cost,
    }));
  const currentYearMargin = marginByYear[currentYear];
  const currentMonthMargin = marginByMonth[currentMonth];

  return (
    <div className="space-y-4">
      {/* Report Reminders */}
      {overdueReports.length > 0 && (
        <div className="bg-white border-l-[3px] border-l-red-500 rounded-md shadow-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-red-700">
              {overdueReports.length} pending report{overdueReports.length > 1 ? "s" : ""}
            </span>
            <Link href="/reports/schedule" className="text-xs text-red-600 hover:underline">View →</Link>
          </div>
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBig label="Total Volume" value={formatNumber(kpis.totalTons, 0)} unit="TN" color="blue" href="/reports" animatedValue={kpis.totalTons} />
        <KPIBig label="Total Shipments" value={totalCount.toString()} unit="shipments" color="blue" href="/reports" animatedValue={totalCount} />
        <KPIBig label="Total Sales" value={`$${formatNumber(kpis.totalRevenue / 1000000, 2)}M`} unit="USD" color="green" href="/reports" animatedValue={kpis.totalRevenue} />
        <KPIBig label="Total Margin" value={`$${formatNumber(kpis.grossProfit / 1000000, 2)}M`} unit={`${formatPercent(kpis.grossMargin)} margin`} color="green" href="/reports" animatedValue={kpis.grossProfit} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPIBig label="Active PO's" value={kpis.activePOs.toString()} unit="active orders" color="amber" href="/purchase-orders?status=active" animatedValue={kpis.activePOs} />
        <KPIBig label="Open Invoices" value={kpis.unpaidInvoices.toString()} unit="unpaid" color="amber" href="/invoices?status=unpaid" animatedValue={kpis.unpaidInvoices} />
        <KPIBig label="Accounts Receivable" value={formatCurrency(kpis.accountsReceivable)} unit="clients owe BZA" color="green" href="/invoices?status=unpaid" animatedValue={kpis.accountsReceivable} />
        <KPIBig label="Suppliers Owed" value={formatCurrency(supplierBalance)} unit={supplierBalanceNet > 0 ? "you owe" : supplierBalanceNet < 0 ? "they owe you" : "settled"} color={supplierBalanceNet > 0 ? "red" : supplierBalanceNet < 0 ? "green" : "amber"} href="/suppliers" animatedValue={supplierBalance} />
      </div>


      {/* AR Aging Summary */}
      {(() => {
        const today = new Date();
        let arTotal = 0, arOverdue = 0, arCurrent = 0;
        let ar0to30 = 0, ar31to60 = 0, ar61plus = 0;
        let overdueCount = 0, currentCount = 0;

        for (const r of allInvoices) {
          if (r.invoice.customerPaymentStatus !== "unpaid") continue;
          const sellPrice = r.invoice.sellPriceOverride ?? r.poSellPrice ?? 0;
          const amount = r.invoice.quantityTons * sellPrice;
          arTotal += amount;

          const dueDate = r.invoice.dueDate ? new Date(r.invoice.dueDate) : null;
          if (dueDate) {
            const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (days > 0) {
              arOverdue += amount;
              overdueCount++;
            } else {
              arCurrent += amount;
              currentCount++;
              const daysLeft = Math.abs(days);
              if (daysLeft <= 30) ar0to30 += amount;
              else if (daysLeft <= 60) ar31to60 += amount;
              else ar61plus += amount;
            }
          } else {
            arCurrent += amount;
            currentCount++;
          }
        }

        if (arTotal === 0) return null;

        return (
          <Link href="/invoices?status=unpaid" className="block hover:opacity-90 transition-opacity">
            <div className="bg-white rounded-md shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Accounts Receivable (AR)</h3>
                <span className="text-lg font-bold">{formatCurrency(arTotal)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className={`rounded-lg p-2 ${arOverdue > 0 ? "bg-white border-l-[3px] border-l-red-500" : "bg-muted/50"}`}>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={`text-sm font-bold ${arOverdue > 0 ? "text-red-600" : ""}`}>{formatCurrency(arOverdue)}</p>
                  <p className="text-xs text-muted-foreground">{overdueCount} invoices</p>
                </div>
                <div className="bg-white border-l-[3px] border-l-emerald-500 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(arCurrent)}</p>
                  <p className="text-xs text-muted-foreground">{currentCount} invoices</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Due 0-30d</p>
                  <p className="text-sm font-bold">{formatCurrency(ar0to30)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Due 31-60d</p>
                  <p className="text-sm font-bold">{formatCurrency(ar31to60)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Due 61d+</p>
                  <p className="text-sm font-bold">{formatCurrency(ar61plus)}</p>
                </div>
              </div>
            </div>
          </Link>
        );
      })()}

      {/* Row 2: Charts + KPI Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Charts take 3 columns */}
        <div className="lg:col-span-3 space-y-4">
          <DashboardVisuals
            recentShipments={recentShipments}
            volumeByMonth={volumeByMonth}
            volumeByTransport={volumeByTransport}
            volumeByStatus={volumeByStatus}
            volumeByClient={volumeByClient}
            volumeBySupplier={volumeBySupplier}
            volumeByIncoterm={volumeByIncoterm}
          />

          {/* Market Prices - full width under charts */}
          <MarketPricesWidget prices={allMarketPrices} />
        </div>

        {/* KPI Gauges + Stats column */}
        <div className="space-y-3">
          <GaugeCard label="Delivery" value={deliveryRate} description={`${deliveredCount}/${totalCount} delivered`} />
          <GaugeCard label="Collection" value={collectionRate} description={`${totalPaid}/${totalCount} paid`} />
          <GaugeCard label="Margin" value={kpis.grossMargin} description={`$${formatNumber(kpis.grossProfit, 0)} profit`} />

          {/* Margin & Profit by Year */}
          <Link href="/reports" className="bg-white rounded-md shadow-sm p-3 space-y-1.5 block hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-muted-foreground uppercase">Margin & Profit by Year</p>
            {marginYearData.map((m) => (
              <div key={m.year} className="space-y-0.5">
                <div className="flex justify-between text-sm">
                  <span className={m.year === currentYear ? "font-bold" : ""}>{m.year}</span>
                  <span className={`font-medium ${m.margin >= 10 ? "text-green-600" : "text-amber-600"}`}>
                    {formatPercent(m.margin)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Profit</span>
                  <span className="text-green-600 font-medium">${formatNumber(m.profit, 0)}</span>
                </div>
              </div>
            ))}
          </Link>

          {/* Current period */}
          <Link href="/reports" className="bg-white rounded-md shadow-sm p-3 space-y-2 block hover:shadow-md transition-shadow">
            <p className="text-xs font-medium text-muted-foreground uppercase">Current Period</p>
            <div>
              <div className="flex justify-between text-sm">
                <span>This Year ({currentYear})</span>
                <span className="font-bold text-green-600">
                  {currentYearMargin ? formatPercent((currentYearMargin.revenue - currentYearMargin.cost) / (currentYearMargin.revenue || 1) * 100) : "N/A"}
                </span>
              </div>
              {currentYearMargin && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Profit</span>
                  <span className="text-green-600 font-medium">${formatNumber(currentYearMargin.revenue - currentYearMargin.cost, 0)}</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>This Month</span>
                <span className="font-bold text-green-600">
                  {currentMonthMargin ? formatPercent((currentMonthMargin.revenue - currentMonthMargin.cost) / (currentMonthMargin.revenue || 1) * 100) : "N/A"}
                </span>
              </div>
              {currentMonthMargin && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Profit</span>
                  <span className="text-green-600 font-medium">${formatNumber(currentMonthMargin.revenue - currentMonthMargin.cost, 0)}</span>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>

      {/* Row 4: Map */}
      <ShipmentMap locationData={locationData} />
    </div>
  );
}

function GaugeCard({ label, value, description }: { label: string; value: number; description: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";

  return (
    <div className="bg-white rounded-md shadow-sm p-4 flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 85">
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#e7e5e4" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 75 A 60 60 0 0 1 130 75"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 188} 188`}
        />
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="600" fill="#1c1917">
          {formatPercent(pct)}
        </text>
      </svg>
      <p className="text-sm font-medium text-stone-700 mt-1">{label}</p>
      <p className="text-xs text-stone-400">{description}</p>
    </div>
  );
}
