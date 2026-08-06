"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatNumber, formatPercent, formatDate, shipmentStatusLabels } from "@/lib/utils";
import { ShipmentMap } from "@/components/shipment-map";
import { CreditInsuranceAlert } from "@/components/credit-insurance-alert";
import type { CreditInsuranceData } from "@/server/credit-insurance";

// ---- BZA green scale: intense → light (monochrome, on-brand) ----
const G = {
  d1: "#082826", // most intense
  d2: "#0d3d3b", // BZA primary
  d3: "#12514e",
  d4: "#1c6b66",
  m:  "#2f8a80",
  l1: "#5aa89e",
  l2: "#8fc7be",
  l3: "#c2e0da",
  l4: "#e6f1ee", // lightest
  ink: "#33544d", // muted green — replaces near-black for numbers/text
};
const HEAT = [G.l4, G.l2, G.m, G.d3, G.d1]; // light → intense buckets

export type Row = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  supplierName: string;
  product: string;
  transport: "Rail" | "Ocean" | "Truck" | "Other";
  destination: string;
  tons: number;
  sellPrice: number;
  buyPrice: number;
  freight: number;
  shipmentDate: string | null;
  shipmentStatus: string;
  custUnpaid: boolean;
  supUnpaid: boolean;
  dueDate: string | null;
};

type Props = {
  rows: Row[];
  supplierBalance: number;
  supplierBalanceNet: number;
  activePOs: number;
  creditInsurance: CreditInsuranceData;
  overdueReportsCount: number;
};

type Period = "month" | "year" | "all";
type Tab = "exec" | "ops" | "fin" | "hist";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DashboardApp({
  rows, supplierBalance, supplierBalanceNet, activePOs, creditInsurance, overdueReportsCount,
}: Props) {
  const [tab, setTab] = useState<Tab>("exec");
  const [period, setPeriod] = useState<Period>("all");

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const curYear = String(now.getFullYear());

  // Period filter (Histórico ignores it — it IS the time view)
  const scoped = useMemo(() => {
    if (period === "all") return rows;
    const prefix = period === "month" ? curMonth : curYear;
    return rows.filter((r) => r.shipmentDate?.startsWith(prefix));
  }, [rows, period, curMonth, curYear]);

  const s = useMemo(() => computeStats(scoped), [scoped]);
  const hist = useMemo(() => computeHistorical(rows, curMonth), [rows, curMonth]);

  // Latest sale/purchase price per product — from each product's most recent shipment (all-time).
  const latestPrices = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      if (!r.product || !r.shipmentDate || !(r.sellPrice > 0)) continue;
      const cur = map.get(r.product);
      if (!cur || r.shipmentDate > (cur.shipmentDate ?? "")) map.set(r.product, r);
    }
    return [...map.values()]
      .map((r) => ({ product: r.product, sold: r.sellPrice, bought: r.buyPrice, date: r.shipmentDate, client: r.clientName }))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [rows]);

  const periodLabel = period === "month" ? "this month" : period === "year" ? `${curYear}` : "all time";

  return (
    <div className="space-y-4" style={{ color: G.ink }}>
      {overdueReportsCount > 0 && (
        <div className="bg-white border-l-[3px] border-l-[#0d3d3b] rounded-md shadow-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#0d3d3b]">
              {overdueReportsCount} pending report{overdueReportsCount > 1 ? "s" : ""}
            </span>
            <Link href="/reports/schedule" className="text-xs text-[#0d3d3b] hover:underline">View →</Link>
          </div>
        </div>
      )}

      {/* Tabs + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-stone-100 p-1 gap-0.5">
          {([["exec", "Executive"], ["ops", "Operations"], ["fin", "Financial"], ["hist", "Historical"]] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${tab === k ? "bg-white shadow-sm text-[#0d3d3b]" : "text-stone-500 hover:text-stone-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== "hist" && (
          <div className="inline-flex rounded-xl bg-stone-100 p-1 gap-0.5">
            {([["month", "This month"], ["year", "This year"], ["all", "All time"]] as [Period, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${period === k ? "bg-white shadow-sm text-[#0d3d3b]" : "text-stone-500 hover:text-stone-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "exec" && <ExecTab s={s} periodLabel={periodLabel} activePOs={activePOs} supplierBalance={supplierBalance} supplierBalanceNet={supplierBalanceNet} creditInsurance={creditInsurance} latestPrices={latestPrices} onNav={setTab} />}
      {tab === "ops" && <OpsTab s={s} rows={scoped} period={period} periodLabel={periodLabel} />}
      {tab === "fin" && <FinTab s={s} rows={scoped} periodLabel={periodLabel} supplierBalance={supplierBalance} supplierBalanceNet={supplierBalanceNet} onNav={setTab} />}
      {tab === "hist" && <HistTab hist={hist} />}
    </div>
  );
}

// ============================ Executive ============================
type PriceRow = { product: string; sold: number; bought: number; date: string | null; client: string };
function ExecTab({ s, periodLabel, activePOs, supplierBalance, supplierBalanceNet, creditInsurance, latestPrices, onNav }: {
  s: Stats; periodLabel: string; activePOs: number; supplierBalance: number; supplierBalanceNet: number;
  creditInsurance: Props["creditInsurance"]; latestPrices: PriceRow[]; onNav: (t: Tab) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button type="button" onClick={() => onNav("hist")} className="block w-full text-left rounded-xl p-5 text-white shadow-sm relative overflow-hidden hover:shadow-md transition-shadow" style={{ background: `linear-gradient(155deg, ${G.d3}, ${G.d1})` }}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Total Sales</p>
          <p className="text-4xl font-extrabold mt-2 tracking-tight tabular-nums">{compactUSD(s.revenue)}</p>
          <p className="text-xs text-white/80 mt-2">{s.shipments} shipments · {periodLabel}</p>
        </button>
        <HeroCard label="Gross Profit" value={compactUSD(s.profit)} sub={`Margin ${formatPercent(s.margin)}`} valueColor={G.d4} onClick={() => onNav("fin")} />
        <HeroCard label="Total Volume" value={`${formatNumber(s.tons, 0)}`} unit="TN" sub={`${s.shipments} shipments`} onClick={() => onNav("hist")} />
      </div>

      {/* Secondary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKPI label="Active POs" value={activePOs.toString()} href="/purchase-orders?status=active" />
        <MiniKPI label="Open Invoices" value={s.unpaidCount.toString()} sub="unpaid" href="/invoices?status=unpaid" />
        <MiniKPI label="Accounts Receivable" value={compactUSD(s.arTotal)} valueColor={G.d4} href="/invoices?status=unpaid" />
        <MiniKPI label="Accounts Payable" value={compactUSD(supplierBalance)} sub={supplierBalanceNet > 0 ? "you owe" : supplierBalanceNet < 0 ? "they owe you" : "settled"} href="/accounts-payable" />
      </div>

      <CreditInsuranceAlert data={creditInsurance} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs cost */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-700">Revenue vs. Cost by month</h3>
            <Legend items={[["Revenue", G.m], ["Cost", "#a8a29e"], ["Profit", G.d2]]} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.byMonth} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.m} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={G.m} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(v, n) => [`$${formatNumber(Number(v), 0)}`, String(n)]}
                  contentStyle={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, fontSize: 11 }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={G.m} strokeWidth={2} fill="url(#revG)" dot={false} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke={G.d2} strokeWidth={2} fill="none" dot={false} />
                <Area type="monotone" dataKey="cost" name="Cost" stroke="#a8a29e" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-700">AR aging</h3>
                <Link href="/reports/ar-aging-detail" className="text-[11px] text-[#0d3d3b] hover:underline">View →</Link>
              </div>
              <span className="text-sm font-bold tabular-nums">{formatCurrency(s.arTotal)}</span>
            </div>
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 my-3">
              <Seg v={s.arOverdue} color={G.d1} />
              <Seg v={s.arCurrent0} color={G.d3} />
              <Seg v={s.ar0to30} color={G.m} />
              <Seg v={s.ar31to60} color={G.l1} />
              <Seg v={s.ar61plus} color={G.l2} />
            </div>
            <div className="space-y-1.5 text-xs">
              <Link href="/invoices?status=unpaid" className="block hover:bg-stone-50 rounded -mx-1 px-1"><AgeRow color={G.d1} label={`Overdue · ${s.overdueCount} inv.`} amt={s.arOverdue} /></Link>
              <AgeRow color={G.d3} label="Due 0–30d" amt={s.ar0to30} />
              <AgeRow color={G.m} label="Due 31–60d" amt={s.ar31to60} />
              <AgeRow color={G.l1} label="Due 61d+" amt={s.ar61plus} />
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Rates</h3>
            <div className="flex justify-around">
              <Link href="/reports/shipments" className="hover:opacity-80 transition-opacity" title="See shipments"><Gauge label="Delivery" value={s.deliveryRate} sub={`${s.deliveredCount}/${s.shipments}`} /></Link>
              <Link href="/payments" className="hover:opacity-80 transition-opacity" title="See customer payments"><Gauge label="Collection" value={s.collectionRate} sub={`${s.paidCount}/${s.shipments}`} /></Link>
            </div>
          </Card>
        </div>
      </div>

      <LatestPriceCard items={latestPrices} />
    </div>
  );
}

function LatestPriceCard({ items }: { items: PriceRow[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-stone-700">Latest price by product</h3>
          <Link href="/market-prices" className="text-[11px] text-[#0d3d3b] hover:underline">Market prices →</Link>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Most recent shipment · $/TN</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[540px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-stone-400 border-b border-stone-100">
              <th className="py-2 font-medium text-left">Product</th>
              <th className="py-2 font-medium text-right">Sold</th>
              <th className="py-2 font-medium text-right">Bought</th>
              <th className="py-2 font-medium text-right">Margin</th>
              <th className="py-2 font-medium text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const m = it.sold - it.bought;
              const mp = it.sold > 0 ? (m / it.sold) * 100 : 0;
              return (
                <tr key={it.product} className="border-b border-stone-50 last:border-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium" style={{ color: G.ink }}>{it.product}</p>
                    {it.client && <p className="text-[11px] text-stone-400">{it.client}</p>}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums" style={{ color: G.d2 }}>${formatNumber(it.sold, 0)}</td>
                  <td className="py-2 text-right tabular-nums text-stone-600">${formatNumber(it.bought, 0)}</td>
                  <td className="py-2 text-right tabular-nums font-semibold" style={{ color: m >= 0 ? G.d4 : "#b23b57" }}>${formatNumber(m, 0)} · {formatPercent(mp)}</td>
                  <td className="py-2 text-right tabular-nums text-stone-500">{formatDate(it.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================ Operations ============================
type DrillKey = "volume" | "shipments" | "delivered" | "sales" | "margin";
const DRILLS: Record<DrillKey, { label: string; val: (r: Row) => number; fmt: (v: number) => string }> = {
  volume:    { label: "Volume", val: (r) => r.tons, fmt: (v) => `${formatNumber(v, 0)} TN` },
  shipments: { label: "Shipments", val: () => 1, fmt: (v) => String(Math.round(v)) },
  delivered: { label: "Delivered", val: (r) => (r.shipmentStatus === "entregado" ? 1 : 0), fmt: (v) => String(Math.round(v)) },
  sales:     { label: "Sales", val: (r) => r.tons * r.sellPrice, fmt: (v) => compactUSD(v) },
  margin:    { label: "Gross Profit", val: (r) => r.tons * (r.sellPrice - r.buyPrice), fmt: (v) => compactUSD(v) },
};

function OpsTab({ s, rows, period, periodLabel }: { s: Stats; rows: Row[]; period: Period; periodLabel: string }) {
  const inTransit = s.inTransit;
  const [drill, setDrill] = useState<DrillKey | null>(null);
  const toggle = (k: DrillKey) => setDrill((d) => (d === k ? null : k));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
        <Stat label="Volume TN" value={formatNumber(s.tons, 0)} color={G.d2} onClick={() => toggle("volume")} selected={drill === "volume"} />
        <Stat label="Shipments" value={s.shipments.toString()} color={G.d2} onClick={() => toggle("shipments")} selected={drill === "shipments"} />
        <Stat label="In transit" value={inTransit.length.toString()} color={G.m} href="/reports/shipments" />
        <Stat label="Delivered" value={s.deliveredCount.toString()} color={G.d3} onClick={() => toggle("delivered")} selected={drill === "delivered"} />
        <Stat label="Sales" value={compactUSD(s.revenue)} color={G.d4} onClick={() => toggle("sales")} selected={drill === "sales"} />
        <Stat label="Margin" value={formatPercent(s.margin)} color={G.d1} onClick={() => toggle("margin")} selected={drill === "margin"} />
      </div>

      {drill && <DrillPanel drill={drill} rows={rows} period={period} periodLabel={periodLabel} onClose={() => setDrill(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ShipmentMap locationData={s.locationData} />
        </div>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-stone-700">In transit now</h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: G.l4, color: G.d2 }}>{inTransit.length} active</span>
          </div>
          <div className="divide-y divide-stone-100">
            {inTransit.length === 0 && <p className="text-xs text-stone-400 py-6 text-center">No active shipments in this period</p>}
            {inTransit.slice(0, 9).map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: destColor(r.destination) }} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-700 truncate">{r.invoiceNumber}</p>
                  <p className="text-[11px] text-stone-400 truncate">{r.clientName || "—"} · {r.destination || "—"}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-extrabold tabular-nums">{formatNumber(r.tons, 0)} TN</p>
                  <p className="text-[11px] text-stone-400">{r.transport}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-stone-700">Shipment status</h3>
          <div className="flex h-7 rounded-lg overflow-hidden gap-0.5 mt-3">
            <Seg v={s.statusDelivered} color={G.d2} />
            <Seg v={s.statusScheduled} color={G.m} />
            <Seg v={s.statusTransit} color={G.l1} />
          </div>
          <div className="mt-3"><Legend items={[["Delivered", G.d2], ["Scheduled", G.m], ["In transit", G.l1]]} /></div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-stone-700 mb-2">Transport mode</h3>
          <Donut segments={s.transportMix} centerLabel={s.shipments.toString()} centerSub="shipments" />
        </Card>
      </div>
    </div>
  );
}

// ============================ Financial ============================
function FinTab({ s, rows, periodLabel, supplierBalance, supplierBalanceNet, onNav }: { s: Stats; rows: Row[]; periodLabel: string; supplierBalance: number; supplierBalanceNet: number; onNav: (t: Tab) => void }) {
  const ar = s.arTotal;
  const ap = supplierBalance;
  const net = ar - ap;
  const maxV = Math.max(ar, ap, 1);
  const maxClient = Math.max(...s.topClients.map((c) => c.tons), 1);
  const [selClient, setSelClient] = useState<string | null>(null);

  const clientShipments = useMemo(() => {
    if (!selClient) return [];
    return rows
      .filter((r) => (r.clientName || "—") === selClient)
      .map((r) => ({ r, sales: r.tons * r.sellPrice }))
      .sort((a, b) => b.sales - a.sales);
  }, [selClient, rows]);
  const clientTotals = useMemo(() => ({
    tons: clientShipments.reduce((n, x) => n + x.r.tons, 0),
    sales: clientShipments.reduce((n, x) => n + x.sales, 0),
  }), [clientShipments]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="lg:row-span-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Margin & profit by year</h3>
          <button onClick={() => onNav("hist")} className="text-[11px] font-semibold text-[#0d3d3b] hover:underline">Full history →</button>
        </div>
        <div className="flex items-end gap-4 h-44 mt-5">
          {s.byYear.map((y) => {
            const max = Math.max(...s.byYear.map((x) => x.tons), 1);
            const hot = y.year === String(new Date().getFullYear());
            return (
              <button key={y.year} type="button" onClick={() => onNav("hist")} title={`See ${y.year} month by month`}
                className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full hover:opacity-80 transition-opacity">
                <span className="text-[10px] font-bold" style={{ color: G.d4 }}>{formatPercent(y.margin)}</span>
                <span className="text-[11px] font-bold tabular-nums">{compactUSD(y.profit)}</span>
                <div className="w-3/5 max-w-[46px] rounded-t-md" style={{ height: `${(y.tons / max) * 100}%`, background: hot ? `linear-gradient(180deg, ${G.d2}, ${G.d1})` : `linear-gradient(180deg, ${G.m}, ${G.d3})` }} />
                <span className="text-[11px] tabular-nums" style={{ color: hot ? G.d2 : "#a8a29e", fontWeight: hot ? 700 : 400 }}>{y.year}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-400 mt-3 pt-3 border-t border-stone-100">Bar height = volume · label = profit &amp; margin · click a year for the full monthly history</p>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-stone-700">Cash position</h3>
        <div className="flex items-center gap-2 mt-4">
          <Link href="/invoices?status=unpaid" className="flex-1 rounded-lg hover:bg-stone-50 transition-colors" title="See unpaid customer invoices">
            <CashSide label="Receivable" value={compactUSD(ar)} color={G.d3} pct={(ar / maxV) * 100} />
          </Link>
          <span className="text-stone-300 font-bold pb-4">−</span>
          <Link href="/accounts-payable" className="flex-1 rounded-lg hover:bg-stone-50 transition-colors" title="See accounts payable">
            <CashSide label="Payable" value={compactUSD(ap)} color={G.l1} pct={(ap / maxV) * 100} />
          </Link>
          <span className="text-stone-300 font-bold pb-4">=</span>
          <div className="flex-1">
            <CashSide label="Net" value={`${net >= 0 ? "+" : "−"}${compactUSD(Math.abs(net))}`} color={G.d1} pct={(Math.abs(net) / maxV) * 100} />
          </div>
        </div>
        <p className="text-[11px] text-stone-400 mt-3">Click Receivable / Payable for the detail.</p>
      </Card>

      <Card>
        {selClient ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0">
                <button onClick={() => setSelClient(null)} className="text-[11px] text-[#0d3d3b] hover:underline">← Top clients</button>
                <h3 className="text-sm font-semibold text-stone-700 truncate">{selClient}</h3>
                <p className="text-[11px] text-stone-400">{periodLabel} · {clientShipments.length} shipments · {formatNumber(clientTotals.tons, 0)} TN · {compactUSD(clientTotals.sales)}</p>
              </div>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {clientShipments.map(({ r, sales }) => (
                <Link key={r.id} href={`/api/invoice-pdf?invoice=${encodeURIComponent(r.invoiceNumber)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-stone-50">
                  <span className="w-2 h-2 rounded-full flex-none" style={{ background: destColor(r.destination) }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-700 truncate">{r.invoiceNumber}</p>
                    <p className="text-[11px] text-stone-400 truncate">{r.shipmentDate ? formatDate(r.shipmentDate) : "—"} · {r.destination || "—"}</p>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <p className="text-xs font-extrabold tabular-nums">{compactUSD(sales)}</p>
                    <p className="text-[11px] text-stone-400">{formatNumber(r.tons, 0)} TN</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-stone-700">Top clients by volume</h3>
            <p className="text-[11px] text-stone-400 mb-3">Click a client for their shipments.</p>
            <div className="flex flex-col gap-2.5">
              {s.topClients.map((c, i) => (
                <button key={c.name} onClick={() => setSelClient(c.name)} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs group text-left">
                  <span className="text-stone-500 group-hover:text-[#0d3d3b] truncate">{c.name}</span>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full group-hover:opacity-80" style={{ width: `${(c.tons / maxClient) * 100}%`, background: shade(i) }} />
                  </div>
                  <span className="font-bold tabular-nums">{formatNumber(c.tons, 0)} TN</span>
                </button>
              ))}
              {s.topClients.length === 0 && <p className="text-xs text-stone-400">No data in this period</p>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ============================ Historical ============================
function HistTab({ hist }: { hist: Historical }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-3 gap-3">
          <KBox label="Historical volume" value={`${formatNumber(hist.totalTons, 0)}`} unit="TN" sub={hist.span} />
          <KBox label="Cumulative sales" value={compactUSD(hist.totalRevenue)} valueColor={G.d3} sub={`${hist.months} months`} />
          <KBox label="Best month" value={hist.bestMonth.label} sub={`${formatNumber(hist.bestMonth.tons, 0)} TN`} />
        </div>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">This month · {hist.thisMonthLabel}</p>
              <p className="text-3xl font-extrabold mt-1.5 tabular-nums">{formatNumber(hist.thisMonth.tons, 0)} <span className="text-base text-stone-400 font-semibold">TN</span></p>
              <p className="text-xs text-stone-400 mt-1">{compactUSD(hist.thisMonth.revenue)} · {hist.thisMonth.count} shipments</p>
            </div>
            {hist.mom !== null && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: G.l4, color: G.d2 }}>
                {hist.mom >= 0 ? "▲" : "▼"} {Math.abs(hist.mom).toFixed(0)}% vs. prev
              </span>
            )}
          </div>
          <div className="h-14 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist.last12} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="msG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.m} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={G.m} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" hide />
                <Tooltip
                  formatter={(v) => [`${formatNumber(Number(v), 0)} TN`, "Volume"]}
                  labelFormatter={(l) => { const [y, m] = String(l).split("-"); return m ? `${MONTHS[Number(m) - 1]} 20${y}` : String(l); }}
                  contentStyle={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, fontSize: 11 }}
                />
                <Area type="monotone" dataKey="tons" stroke={G.m} strokeWidth={2} fill="url(#msG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Monthly sales */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Monthly sales</h3>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{hist.span}</span>
        </div>
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist.salesByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => compactUSD(Number(v))} width={54} />
              <Tooltip
                cursor={{ fill: G.d2, fillOpacity: 0.1 }}
                formatter={(v) => [compactUSD(Number(v)), "Sales"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
              />
              <Bar dataKey="revenue" fill={G.d3} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Heatmap */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Monthly volume by year</h3>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Tons · intensity = volume</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[520px] mt-4">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "34px repeat(12, 1fr)" }}>
              <div />
              {MONTHS.map((m) => <div key={m} className="text-[9.5px] text-center text-stone-400 font-semibold">{m[0]}</div>)}
              {hist.heat.map((row) => (
                <HeatRow key={row.year} year={row.year} cells={row.cells} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 justify-end mt-3 text-[10px] text-stone-400">
          <span>Less</span>
          {HEAT.map((c, i) => <span key={i} className="w-4 h-3 rounded-sm" style={{ background: c, border: i === 0 ? "1px solid #e7e5e4" : "none" }} />)}
          <span>More</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-stone-700">Year over year</h3>
          <div className="flex items-end gap-4 h-40 mt-4">
            {hist.byYear.map((y) => {
              const max = Math.max(...hist.byYear.map((x) => x.tons), 1);
              const hot = y.year === String(new Date().getFullYear());
              return (
                <div key={y.year} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                  <span className="text-[11px] text-stone-500 tabular-nums">{formatNumber(y.tons, 0)} TN</span>
                  <span className="text-[11px] font-bold tabular-nums">{compactUSD(y.revenue)}</span>
                  <div className="w-3/5 max-w-[48px] rounded-t-md" style={{ height: `${(y.tons / max) * 100}%`, background: hot ? `linear-gradient(180deg, ${G.d2}, ${G.d1})` : `linear-gradient(180deg, ${G.m}, ${G.d3})` }} />
                  <span className="text-[11px] tabular-nums" style={{ color: hot ? G.d2 : "#a8a29e", fontWeight: hot ? 700 : 400 }}>{y.year}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-stone-700">Cumulative volume</h3>
          <div className="h-40 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hist.cumulative} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G.d2} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={G.d2} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => [`${formatNumber(Number(v), 0)} TN`, "Cumulative"]} contentStyle={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="tons" stroke={G.d2} strokeWidth={2.5} fill="url(#cumG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================ Small UI pieces ============================
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-stone-100 p-4 ${className}`}>{children}</div>;
}
function HeroCard({ label, value, unit, sub, valueColor, href, onClick }: { label: string; value: string; unit?: string; sub: string; valueColor?: string; href?: string; onClick?: () => void }) {
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-5 h-full hover:shadow-md transition-shadow">
      <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="text-4xl font-extrabold mt-2 tracking-tight tabular-nums" style={{ color: valueColor ?? G.ink }}>{value}{unit && <span className="text-base text-stone-400 font-semibold"> {unit}</span>}</p>
      <p className="text-xs text-stone-400 mt-2">{sub}</p>
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{inner}</button>;
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
function MiniKPI({ label, value, sub, valueColor, href }: { label: string; value: string; sub?: string; valueColor?: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4 h-full hover:shadow-md transition-shadow">
      <p className="text-2xl font-extrabold tracking-tight tabular-nums" style={{ color: valueColor ?? G.ink }}>{value}</p>
      <p className="text-xs text-stone-500 mt-1">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
function Stat({ label, value, color, href, onClick, selected }: { label: string; value: string; color: string; href?: string; onClick?: () => void; selected?: boolean }) {
  const inner = (
    <div className={`bg-white rounded-xl shadow-sm border p-3 relative overflow-hidden h-full transition-shadow hover:shadow-md ${selected ? "border-[#0d3d3b] ring-1 ring-[#0d3d3b]/30" : "border-stone-100"}`}>
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: color }} />
      <p className="text-lg font-extrabold tracking-tight tabular-nums pl-1">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-stone-400 mt-0.5 pl-1">{label}</p>
    </div>
  );
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left cursor-pointer">{inner}</button>;
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// Period-aware breakdown shown when an Operations KPI is clicked.
// Groups by month (all/year period) or by client (this-month period).
function DrillPanel({ drill, rows, period, periodLabel, onClose }: { drill: DrillKey; rows: Row[]; period: Period; periodLabel: string; onClose: () => void }) {
  const cfg = DRILLS[drill];
  const byClient = period === "month";
  const [sub, setSub] = useState<string | null>(null); // 2nd level: a group drilled into
  const keyOf = (r: Row) => (byClient ? (r.clientName || "—") : (r.shipmentDate?.slice(0, 7) || "—"));
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    return m ? `${MONTHS[Number(m) - 1]} ${String(y).slice(2)}` : ym;
  };
  const groupLabel = (k: string) => (byClient ? k : monthLabel(k));

  const { entries, total } = useMemo(() => {
    const g = new Map<string, number>();
    for (const r of rows) g.set(keyOf(r), (g.get(keyOf(r)) || 0) + cfg.val(r));
    let list = [...g.entries()].filter(([, v]) => v !== 0);
    list = byClient ? list.sort((a, b) => b[1] - a[1]) : list.sort((a, b) => a[0].localeCompare(b[0]));
    return { entries: list, total: list.reduce((sum, [, v]) => sum + v, 0) };
  }, [rows, cfg, byClient]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(...entries.map(([, v]) => v), 1);

  // 2nd level: the individual shipments inside the selected group (that count for this metric).
  const detail = useMemo(() => {
    if (!sub) return [];
    return rows
      .filter((r) => keyOf(r) === sub && cfg.val(r) !== 0)
      .map((r) => ({ r, v: cfg.val(r) }))
      .sort((a, b) => b.v - a.v);
  }, [sub, rows, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          {sub ? (
            <>
              <button onClick={() => setSub(null)} className="text-[11px] text-[#0d3d3b] hover:underline">← {cfg.label} by {byClient ? "customer" : "month"}</button>
              <h3 className="text-sm font-semibold text-stone-700 truncate">{cfg.label} · {groupLabel(sub)} <span className="text-stone-400 font-normal">({detail.length} shipment{detail.length === 1 ? "" : "s"})</span></h3>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-stone-700">{cfg.label} — by {byClient ? "customer" : "month"}</h3>
              <p className="text-[11px] text-stone-400">{periodLabel} · total {cfg.fmt(total)} · <span className="text-stone-400">click a {byClient ? "customer" : "month"} for detail</span></p>
            </>
          )}
        </div>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-700 shrink-0 ml-3">Close ✕</button>
      </div>

      {/* Level 2: individual shipments */}
      {sub ? (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {detail.map(({ r, v }) => (
            <Link key={r.id} href={`/api/invoice-pdf?invoice=${encodeURIComponent(r.invoiceNumber)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-stone-50">
              <span className="w-2 h-2 rounded-full flex-none" style={{ background: destColor(r.destination) }} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-700 truncate">{r.invoiceNumber}</p>
                <p className="text-[11px] text-stone-400 truncate">{byClient ? (r.shipmentDate ? formatDate(r.shipmentDate) : "—") : (r.clientName || "—")} · {r.destination || "—"}</p>
              </div>
              <div className="ml-auto text-right shrink-0">
                <p className="text-xs font-extrabold tabular-nums">{cfg.fmt(v)}</p>
                <p className="text-[11px] text-stone-400">{formatNumber(r.tons, 0)} TN</p>
              </div>
            </Link>
          ))}
          {detail.length === 0 && <p className="text-xs text-stone-400 py-4 text-center">No shipments.</p>}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-stone-400 py-4 text-center">No data in this period.</p>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {entries.map(([k, v]) => (
            <button key={k} onClick={() => setSub(k)} className="w-full flex items-center gap-3 group text-left">
              <span className="text-xs text-stone-500 group-hover:text-[#0d3d3b] w-28 shrink-0 truncate" title={groupLabel(k)}>{groupLabel(k)}</span>
              <div className="flex-1 bg-stone-100 rounded h-4 overflow-hidden">
                <div className="h-full rounded transition-all group-hover:opacity-80" style={{ width: `${(v / max) * 100}%`, background: G.d3 }} />
              </div>
              <span className="text-xs font-bold text-stone-700 tabular-nums w-20 text-right shrink-0">{cfg.fmt(v)}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
function KBox({ label, value, unit, sub, valueColor, href }: { label: string; value: string; unit?: string; sub: string; valueColor?: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4 h-full hover:shadow-md transition-shadow">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400">{label}</p>
      <p className="text-2xl font-extrabold mt-2 tracking-tight tabular-nums" style={{ color: valueColor ?? G.ink }}>{value}{unit && <span className="text-sm text-stone-400 font-semibold"> {unit}</span>}</p>
      <p className="text-[11px] text-stone-400 mt-1.5">{sub}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex gap-3 flex-wrap text-[11px] text-stone-500">
      {items.map(([l, c]) => <span key={l} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</span>)}
    </div>
  );
}
function Seg({ v, color }: { v: number; color: string }) {
  if (v <= 0) return null;
  return <div className="flex items-center justify-center text-[10px] font-bold text-white rounded-sm" style={{ flexGrow: v, minWidth: 0, background: color }} />;
}
function AgeRow({ color, label, amt }: { color: string; label: string; amt: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-stone-500"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>
      <span className="font-bold text-stone-700 tabular-nums">{formatCurrency(amt)}</span>
    </div>
  );
}
function Gauge({ label, value, sub }: { label: string; value: number; sub: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex flex-col items-center">
      <svg width="96" height="60" viewBox="0 0 140 85">
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#e7e5e4" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke={G.m} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 188} 188`} />
      </svg>
      <p className="text-xl font-extrabold -mt-2 tabular-nums" style={{ color: G.d2 }}>{formatPercent(pct)}</p>
      <p className="text-xs font-medium text-stone-600">{label}</p>
      <p className="text-[11px] text-stone-400">{sub}</p>
    </div>
  );
}
function CashSide({ label, value, color, pct }: { label: string; value: string; color: string; pct: number }) {
  return (
    <div className="flex-1">
      <p className="text-[10.5px] uppercase tracking-wide text-stone-400">{label}</p>
      <p className="text-xl font-extrabold mt-1 tabular-nums" style={{ color }}>{value}</p>
      <div className="h-2.5 rounded-md mt-2" style={{ width: `${Math.max(pct, 4)}%`, background: color }} />
    </div>
  );
}
function Donut({ segments, centerLabel, centerSub }: { segments: { label: string; pct: number; color: string }[]; centerLabel: string; centerSub: string }) {
  let acc = 0;
  const stops = segments.map((seg) => {
    const start = acc; acc += seg.pct;
    return `${seg.color} ${start}% ${acc}%`;
  }).join(", ");
  return (
    <div className="flex items-center gap-5">
      <div className="relative w-28 h-28 flex-none rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-7 bg-white rounded-full flex flex-col items-center justify-center">
          <span className="text-base font-extrabold tabular-nums">{centerLabel}</span>
          <span className="text-[9px] uppercase tracking-wide text-stone-400">{centerSub}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-stone-500">
            <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />{seg.label}
            <b className="ml-auto text-stone-800 tabular-nums">{seg.pct.toFixed(0)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function HeatRow({ year, cells }: { year: string; cells: (number | null)[] }) {
  return (
    <>
      <div className="text-[11px] text-stone-500 font-bold self-center tabular-nums">{year}</div>
      {cells.map((v, i) => (
        <div
          key={i}
          className="relative group cursor-pointer"
          style={{ aspectRatio: "1.15" }}
          title={v === null ? `${year} ${MONTHS[i]} · no ops` : `${year} ${MONTHS[i]} · ${Math.round(v)} TN`}
        >
          <div
            className="w-full h-full rounded-sm transition-all group-hover:ring-2 group-hover:ring-[#0d3d3b]"
            style={{
              background: v === null ? "repeating-linear-gradient(45deg,#f5f5f4,#f5f5f4 4px,transparent 4px,transparent 7px)" : heatColor(v),
              opacity: v === null ? 0.5 : 1,
            }}
          />
          {/* value on hover (inside the cell so it never gets clipped by the scroll container) */}
          <div className="pointer-events-none absolute inset-0 hidden group-hover:flex items-center justify-center rounded-sm bg-[#0d3d3b]/90">
            <span className="text-[9px] font-bold text-white tabular-nums leading-none text-center px-0.5">
              {v === null ? "—" : formatNumber(Math.round(v), 0)}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

// ============================ palette helpers ============================
const CLIENT_SHADES = [G.d2, G.d4, G.m, G.l1, "#a8a29e"];
function shade(i: number) { return CLIENT_SHADES[Math.min(i, CLIENT_SHADES.length - 1)]; }
const DEST_COLORS: Record<string, string> = {
  "Laredo": G.d2, "Eagle Pass": G.d4, "El Paso": G.m, "Manzanillo": G.d3, "Veracruz": G.d1,
};
function destColor(d: string) { return DEST_COLORS[d] || "#a8a29e"; }
let HEAT_MAX = 1;
function setHeatMax(v: number) { HEAT_MAX = v || 1; }
function heatColor(v: number) {
  const r = v / HEAT_MAX;
  if (r < 0.2) return HEAT[0];
  if (r < 0.4) return HEAT[1];
  if (r < 0.6) return HEAT[2];
  if (r < 0.8) return HEAT[3];
  return HEAT[4];
}
function compactUSD(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ============================ stats computation ============================
type Stats = ReturnType<typeof computeStats>;
function computeStats(rows: Row[]) {
  const today = new Date();
  let tons = 0, revenue = 0, cost = 0, unpaidCount = 0, paidCount = 0, deliveredCount = 0;
  let arTotal = 0, arOverdue = 0, arCurrent0 = 0, ar0to30 = 0, ar31to60 = 0, ar61plus = 0, overdueCount = 0;
  let statusDelivered = 0, statusScheduled = 0, statusTransit = 0;
  const byMonthMap: Record<string, { tons: number; revenue: number; cost: number }> = {};
  const byYearMap: Record<string, { tons: number; revenue: number; cost: number }> = {};
  const byClient: Record<string, number> = {};
  const byTransport: Record<string, number> = {};
  const byLoc: Record<string, { name: string; tons: number; shipments: number }> = {};
  const inTransit: Row[] = [];

  for (const r of rows) {
    const rev = r.tons * r.sellPrice;
    const cst = r.tons * r.buyPrice + r.freight;
    tons += r.tons; revenue += rev; cost += cst;
    if (r.custUnpaid) {
      unpaidCount++; arTotal += rev;
      if (r.dueDate) {
        const days = Math.floor((today.getTime() - new Date(r.dueDate).getTime()) / 86400000);
        if (days > 0) { arOverdue += rev; overdueCount++; }
        else { const dl = Math.abs(days); if (dl <= 30) ar0to30 += rev; else if (dl <= 60) ar31to60 += rev; else ar61plus += rev; }
      } else { arCurrent0 += rev; }
    } else { paidCount++; }
    if (r.shipmentStatus === "entregado") { deliveredCount++; statusDelivered += r.tons; }
    else if (r.shipmentStatus === "programado") { statusScheduled += r.tons; }
    else { statusTransit += r.tons; }
    if (r.shipmentStatus === "en_transito" || r.shipmentStatus === "en_aduana") inTransit.push(r);

    if (r.shipmentDate) {
      const ym = r.shipmentDate.substring(0, 7);
      const yr = r.shipmentDate.substring(0, 4);
      (byMonthMap[ym] ??= { tons: 0, revenue: 0, cost: 0 }); byMonthMap[ym].tons += r.tons; byMonthMap[ym].revenue += rev; byMonthMap[ym].cost += cst;
      (byYearMap[yr] ??= { tons: 0, revenue: 0, cost: 0 }); byYearMap[yr].tons += r.tons; byYearMap[yr].revenue += rev; byYearMap[yr].cost += cst;
    }
    byClient[r.clientName || "Other"] = (byClient[r.clientName || "Other"] || 0) + r.tons;
    byTransport[r.transport] = (byTransport[r.transport] || 0) + r.tons;
    if (r.destination) { (byLoc[r.destination] ??= { name: r.destination, tons: 0, shipments: 0 }); byLoc[r.destination].tons += r.tons; byLoc[r.destination].shipments += 1; }
  }

  const shipments = rows.length;
  const profit = revenue - cost;
  const byMonth = Object.entries(byMonthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([ym, v]) => ({ month: ym.substring(2), tons: Math.round(v.tons), revenue: Math.round(v.revenue), cost: Math.round(v.cost), profit: Math.round(v.revenue - v.cost) }));
  const byYear = Object.entries(byYearMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, tons: v.tons, revenue: v.revenue, profit: v.revenue - v.cost, margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0 }));
  const topClients = Object.entries(byClient).map(([name, t]) => ({ name: name.split(",")[0].split(" S.A")[0].trim(), tons: t })).sort((a, b) => b.tons - a.tons).slice(0, 5);
  const totTrans = Object.values(byTransport).reduce((a, b) => a + b, 0) || 1;
  const transportMix = Object.entries(byTransport).sort(([, a], [, b]) => b - a).map(([label, t], i) => ({ label, pct: (t / totTrans) * 100, color: [G.d2, G.m, G.l1, G.l2][i] || "#a8a29e" }));

  return {
    tons, revenue, cost, profit, shipments,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    unpaidCount, paidCount, deliveredCount,
    deliveryRate: shipments > 0 ? (deliveredCount / shipments) * 100 : 0,
    collectionRate: shipments > 0 ? (paidCount / shipments) * 100 : 0,
    arTotal, arOverdue, arCurrent0, ar0to30, ar31to60, ar61plus, overdueCount,
    statusDelivered, statusScheduled, statusTransit,
    byMonth, byYear, topClients, transportMix, inTransit,
    locationData: byLoc,
  };
}

// ============================ historical ============================
type Historical = ReturnType<typeof computeHistorical>;
function computeHistorical(rows: Row[], curMonth: string) {
  const byMonthMap: Record<string, { tons: number; revenue: number; count: number }> = {};
  const byYearMap: Record<string, { tons: number; revenue: number }> = {};
  let totalTons = 0, totalRevenue = 0;
  const yearsSet = new Set<string>();

  for (const r of rows) {
    const rev = r.tons * r.sellPrice;
    totalTons += r.tons; totalRevenue += rev;
    if (!r.shipmentDate) continue;
    const ym = r.shipmentDate.substring(0, 7);
    const yr = r.shipmentDate.substring(0, 4);
    yearsSet.add(yr);
    (byMonthMap[ym] ??= { tons: 0, revenue: 0, count: 0 }); byMonthMap[ym].tons += r.tons; byMonthMap[ym].revenue += rev; byMonthMap[ym].count += 1;
    (byYearMap[yr] ??= { tons: 0, revenue: 0 }); byYearMap[yr].tons += r.tons; byYearMap[yr].revenue += rev;
  }

  const months = Object.keys(byMonthMap).sort();
  const years = [...yearsSet].sort();
  const heatMax = Math.max(...Object.values(byMonthMap).map((v) => v.tons), 1);
  setHeatMax(heatMax);

  const heat = years.map((year) => ({
    year,
    cells: MONTHS.map((_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, "0")}`;
      return byMonthMap[key] ? byMonthMap[key].tons : null;
    }),
  }));

  const byYear = years.map((year) => ({ year, tons: byYearMap[year].tons, revenue: byYearMap[year].revenue }));

  // last 12 months trend
  const last12: { month: string; tons: number }[] = [];
  if (months.length) {
    const [ly, lm] = months[months.length - 1].split("-").map(Number);
    for (let k = 11; k >= 0; k--) {
      const d = new Date(ly, lm - 1 - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      last12.push({ month: key.substring(2), tons: byMonthMap[key]?.tons ?? 0 });
    }
  }

  // this month vs previous
  const thisMonth = byMonthMap[curMonth] ?? { tons: 0, revenue: 0, count: 0 };
  const idx = months.indexOf(curMonth);
  const prevKey = idx > 0 ? months[idx - 1] : months[months.length - 1];
  const prev = prevKey && prevKey !== curMonth ? byMonthMap[prevKey] : undefined;
  const mom = prev && prev.tons > 0 ? ((thisMonth.tons - prev.tons) / prev.tons) * 100 : null;

  // best month
  let best = { key: "", tons: 0 };
  for (const [k, v] of Object.entries(byMonthMap)) if (v.tons > best.tons) best = { key: k, tons: v.tons };
  const bestLabel = best.key ? `${MONTHS[Number(best.key.split("-")[1]) - 1]} ${best.key.split("-")[0]}` : "—";

  // cumulative by year
  let run = 0;
  const cumulative = years.map((year) => { run += byYearMap[year].tons; return { label: year, tons: Math.round(run) }; });

  const thisMonthLabel = `${MONTHS[Number(curMonth.split("-")[1]) - 1]} ${curMonth.split("-")[0]}`;
  const span = months.length ? `${MONTHS[Number(months[0].split("-")[1]) - 1]} ${months[0].split("-")[0]} – ${thisMonthLabel}` : "—";

  // full monthly sales series (for the historical sales breakdown)
  const salesByMonth = months.map((m) => ({
    label: `${MONTHS[Number(m.split("-")[1]) - 1]} ${m.split("-")[0].substring(2)}`,
    revenue: Math.round(byMonthMap[m].revenue),
    tons: Math.round(byMonthMap[m].tons),
  }));

  return {
    totalTons, totalRevenue, months: months.length, span,
    heat, byYear, last12, cumulative, salesByMonth,
    thisMonth: { tons: thisMonth.tons, revenue: thisMonth.revenue, count: thisMonth.count },
    thisMonthLabel, mom,
    bestMonth: { label: bestLabel, tons: best.tons },
  };
}
