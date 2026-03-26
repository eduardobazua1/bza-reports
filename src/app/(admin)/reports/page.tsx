import { getInvoices } from "@/server/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

interface EntityKPI {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  avgSellPrice: number;
  avgBuyPrice: number;
  marginPerTon: number;
  totalTons: number;
  totalShipments: number;
  avgTonsPerShipment: number;
  totalPOs: number;
  paidInvoices: number;
  unpaidInvoices: number;
  unpaidRevenue: number;
  activePOs: Set<string>;
  completedPOs: Set<string>;
  // Price history by year
  byYear: Map<string, { tons: number; revenue: number; cost: number; shipments: number }>;
  // Transport type breakdown
  byTransport: Map<string, number>;
}

function newEntity(name: string): EntityKPI {
  return {
    name, revenue: 0, cost: 0, profit: 0, margin: 0,
    avgSellPrice: 0, avgBuyPrice: 0, marginPerTon: 0,
    totalTons: 0, totalShipments: 0, avgTonsPerShipment: 0, totalPOs: 0,
    paidInvoices: 0, unpaidInvoices: 0, unpaidRevenue: 0,
    activePOs: new Set(), completedPOs: new Set(),
    byYear: new Map(),
    byTransport: new Map(),
  };
}

function finalize(e: EntityKPI): EntityKPI {
  e.profit = e.revenue - e.cost;
  e.margin = e.revenue > 0 ? (e.profit / e.revenue) * 100 : 0;
  e.avgSellPrice = e.totalTons > 0 ? e.revenue / e.totalTons : 0;
  e.avgBuyPrice = e.totalTons > 0 ? e.cost / e.totalTons : 0;
  e.marginPerTon = e.avgSellPrice - e.avgBuyPrice;
  e.avgTonsPerShipment = e.totalShipments > 0 ? e.totalTons / e.totalShipments : 0;
  e.totalPOs = new Set([...e.activePOs, ...e.completedPOs]).size;
  return e;
}

function KPICard({ e, type }: { e: EntityKPI; type: "client" | "supplier" }) {
  const yearData = Array.from(e.byYear.entries())
    .map(([year, d]) => ({
      year,
      tons: d.tons,
      avgSell: d.tons > 0 ? d.revenue / d.tons : 0,
      avgBuy: d.tons > 0 ? d.cost / d.tons : 0,
      margin: d.tons > 0 ? (d.revenue - d.cost) / d.tons : 0,
      shipments: d.shipments,
    }))
    .sort((a, b) => a.year.localeCompare(b.year))
    .filter((y) => y.year !== "N/A");

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">{e.name}</h2>
        <div className="flex gap-2">
          {e.activePOs.size > 0 && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
              {e.activePOs.size} active POs
            </span>
          )}
          {e.unpaidInvoices > 0 && (
            <span className="text-xs bg-stone-100 text-amber-600 px-2 py-1 rounded-full">
              {e.unpaidInvoices} pending
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Row 1: Financial summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">
              {type === "client" ? "Revenue" : "Total Cost"}
            </p>
            <p className="text-lg font-semibold text-stone-900">
              {formatCurrency(type === "client" ? e.revenue : e.cost)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Profit</p>
            <p className={`text-lg font-bold ${e.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(e.profit)}
            </p>
            <p className="text-xs text-muted-foreground">Margin: {formatPercent(e.margin)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Margin/TN</p>
            <p className={`text-lg font-bold ${e.marginPerTon >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${formatNumber(e.marginPerTon, 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Tons</p>
            <p className="text-lg font-bold">{formatNumber(e.totalTons, 0)}</p>
            <p className="text-xs text-muted-foreground">{e.totalShipments} shipments</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Avg/Shipment</p>
            <p className="text-lg font-bold">{formatNumber(e.avgTonsPerShipment, 0)} TN</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Receivable</p>
            <p className="text-lg font-semibold text-amber-600">
              {e.unpaidInvoices > 0 ? formatCurrency(e.unpaidRevenue) : "$0"}
            </p>
            <p className="text-xs text-muted-foreground">
              {e.unpaidInvoices > 0 ? `${e.unpaidInvoices} invoices` : "Up to date"}
            </p>
          </div>
        </div>

        {/* Transport breakdown */}
        {e.byTransport.size > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-stone-500 mb-2">Transport Type</p>
            <div className="flex flex-wrap gap-3">
              {Array.from(e.byTransport.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name, tons]) => {
                  const pct = e.totalTons > 0 ? (tons / e.totalTons) * 100 : 0;
                  const dotColors: Record<string, string> = { Railroad: "bg-blue-500", Maritime: "bg-emerald-500", Truck: "bg-amber-500", Other: "bg-stone-400" };
                  return (
                    <div key={name} className="bg-stone-50 px-3 py-2 rounded-md">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${dotColors[name] || dotColors.Other}`} />
                        <p className="text-sm font-semibold text-stone-800">{formatPercent(pct)}</p>
                      </div>
                      <p className="text-xs text-stone-500">{name} — {formatNumber(tons, 0)} TN</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Row 2: Price history by year */}
        {yearData.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-stone-500 mb-2">Performance by Year</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-1 pr-4 font-medium">Year</th>
                    <th className="text-right py-1 px-2 font-medium">TN</th>
                    <th className="text-right py-1 px-2 font-medium">Shipments</th>
                    <th className="text-right py-1 px-2 font-medium">Sell Price</th>
                    <th className="text-right py-1 px-2 font-medium">Buy Price</th>
                    <th className="text-right py-1 px-2 font-medium">Margin/TN</th>
                  </tr>
                </thead>
                <tbody>
                  {yearData.map((y) => (
                    <tr key={y.year} className="border-t border-border/50">
                      <td className="py-1 pr-4 font-medium">{y.year}</td>
                      <td className="py-1 px-2 text-right">{formatNumber(y.tons, 0)}</td>
                      <td className="py-1 px-2 text-right">{y.shipments}</td>
                      <td className="py-1 px-2 text-right">${formatNumber(y.avgSell, 0)}</td>
                      <td className="py-1 px-2 text-right">${formatNumber(y.avgBuy, 0)}</td>
                      <td className={`py-1 px-2 text-right font-medium ${y.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ${formatNumber(y.margin, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReportsPage() {
  const invoiceRows = await getInvoices();

  const clientMap = new Map<string, EntityKPI>();
  const supplierMap = new Map<string, EntityKPI>();

  for (const row of invoiceRows) {
    const clientName = row.clientName || "Unknown";
    const supplierName = row.supplierName || "Unknown";
    const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice = row.invoice.buyPriceOverride ?? row.poBuyPrice ?? 0;
    const revenue = row.invoice.quantityTons * sellPrice;
    const cost = row.invoice.quantityTons * buyPrice + (row.invoice.freightCost || 0);
    const year = row.invoice.shipmentDate
      ? new Date(row.invoice.shipmentDate).getFullYear().toString()
      : "N/A";

    // --- Client ---
    if (!clientMap.has(clientName)) clientMap.set(clientName, newEntity(clientName));
    const c = clientMap.get(clientName)!;
    c.revenue += revenue;
    c.cost += cost;
    c.totalTons += row.invoice.quantityTons;
    c.totalShipments += 1;
    if (row.invoice.customerPaymentStatus === "paid") c.paidInvoices += 1;
    else { c.unpaidInvoices += 1; c.unpaidRevenue += revenue; }
    if (row.poNumber) {
      if (row.invoice.customerPaymentStatus === "paid") c.completedPOs.add(row.poNumber);
      else c.activePOs.add(row.poNumber);
    }
    if (!c.byYear.has(year)) c.byYear.set(year, { tons: 0, revenue: 0, cost: 0, shipments: 0 });
    const cy = c.byYear.get(year)!;
    cy.tons += row.invoice.quantityTons; cy.revenue += revenue; cy.cost += cost; cy.shipments += 1;
    const transport = row.transportType === "ffcc" ? "Railroad" : row.transportType === "ship" ? "Maritime" : row.transportType === "truck" ? "Truck" : "Other";
    c.byTransport.set(transport, (c.byTransport.get(transport) || 0) + row.invoice.quantityTons);

    // --- Supplier ---
    if (!supplierMap.has(supplierName)) supplierMap.set(supplierName, newEntity(supplierName));
    const s = supplierMap.get(supplierName)!;
    s.revenue += revenue;
    s.cost += cost;
    s.totalTons += row.invoice.quantityTons;
    s.totalShipments += 1;
    if (row.invoice.supplierPaymentStatus === "paid") s.paidInvoices += 1;
    else { s.unpaidInvoices += 1; s.unpaidRevenue += cost; }
    if (row.poNumber) {
      if (row.invoice.supplierPaymentStatus === "paid") s.completedPOs.add(row.poNumber);
      else s.activePOs.add(row.poNumber);
    }
    if (!s.byYear.has(year)) s.byYear.set(year, { tons: 0, revenue: 0, cost: 0, shipments: 0 });
    const sy = s.byYear.get(year)!;
    sy.tons += row.invoice.quantityTons; sy.revenue += revenue; sy.cost += cost; sy.shipments += 1;
    const sTransport = row.transportType === "ffcc" ? "Railroad" : row.transportType === "ship" ? "Maritime" : row.transportType === "truck" ? "Truck" : "Other";
    s.byTransport.set(sTransport, (s.byTransport.get(sTransport) || 0) + row.invoice.quantityTons);
  }

  const clients = Array.from(clientMap.values()).map(finalize).sort((a, b) => b.revenue - a.revenue);
  const suppliers = Array.from(supplierMap.values()).map(finalize).sort((a, b) => b.cost - a.cost);

  const totals = clients.reduce(
    (acc, c) => ({
      revenue: acc.revenue + c.revenue, cost: acc.cost + c.cost,
      profit: acc.profit + c.profit, tons: acc.tons + c.totalTons,
      shipments: acc.shipments + c.totalShipments,
      unpaid: acc.unpaid + c.unpaidInvoices, unpaidRev: acc.unpaidRev + c.unpaidRevenue,
    }),
    { revenue: 0, cost: 0, profit: 0, tons: 0, shipments: 0, unpaid: 0, unpaidRev: 0 }
  );

  return (
    <div className="space-y-8">
      {/* Global Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-blue-500 p-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Revenue</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-blue-500 p-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Cost</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{formatCurrency(totals.cost)}</p>
        </div>
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-emerald-500 p-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Profit</p>
          <p className="text-xl font-semibold text-emerald-700 mt-1">{formatCurrency(totals.profit)}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {formatPercent(totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0)} margin
          </p>
        </div>
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-blue-500 p-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tons</p>
          <p className="text-xl font-semibold text-stone-900 mt-1">{formatNumber(totals.tons, 0)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{totals.shipments} shipments</p>
        </div>
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-amber-500 p-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Receivable</p>
          <p className="text-xl font-semibold text-amber-600 mt-1">{formatCurrency(totals.unpaidRev)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{totals.unpaid} invoices</p>
        </div>
      </div>

      {/* CLIENTS */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          Clients
          <span className="text-sm font-normal text-muted-foreground">({clients.length})</span>
        </h2>
        <div className="space-y-4">
          {clients.map((c) => <KPICard key={c.name} e={c} type="client" />)}
        </div>
      </div>

      {/* SUPPLIERS */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          Suppliers
          <span className="text-sm font-normal text-muted-foreground">({suppliers.length})</span>
        </h2>
        <div className="space-y-4">
          {suppliers.map((s) => <KPICard key={s.name} e={s} type="supplier" />)}
        </div>
      </div>
    </div>
  );
}
