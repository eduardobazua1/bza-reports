"use client";

import { useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/utils";

type YearRow = { yr: string; cars: number; tons: number; revenue: number; cost: number; margin: number; marginPct: number; marginPerTon: number };
type DestRow = { destination: string; cars: number; tons: number };
type SpreadRow = { poNumber: string; spread: number };

export type StrategicKpis = {
  cars: number; tons: number; revenue: number; cost: number;
  grossMargin: number; marginPct: number; marginPerTon: number;
  avgCar: number; minCar: number; maxCar: number;
  yearRows: YearRow[]; destRows: DestRow[]; spreadRows: SpreadRow[];
  firstSpread: number; lastSpread: number;
};

const pct = (n: number) => `${n >= 0 ? "" : "-"}${Math.abs(n).toFixed(1)}%`;

export function SupplierStrategicKpis({ kpi, supplierName }: { kpi: StrategicKpis; supplierName: string }) {
  const [open, setOpen] = useState<null | "margin" | "ops" | "spread" | "dest">(null);

  if (!kpi.cars) {
    return (
      <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-stone-300 p-5">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-1">Strategic KPIs</p>
        <p className="text-sm text-stone-400 italic">No shipment data yet for {supplierName}. KPIs will populate once invoices are loaded.</p>
      </div>
    );
  }

  // average spread ($/ton) across all POs — the metric that actually matters
  const avgSpread = kpi.spreadRows.length
    ? kpi.spreadRows.reduce((s, r) => s + r.spread, 0) / kpi.spreadRows.length
    : 0;
  const minSpread = kpi.spreadRows.length ? Math.min(...kpi.spreadRows.map((r) => r.spread)) : 0;
  const maxSpread = kpi.spreadRows.length ? Math.max(...kpi.spreadRows.map((r) => r.spread)) : 0;
  const totalTons = kpi.destRows.reduce((s, d) => s + d.tons, 0) || 1;
  const top2 = kpi.destRows.slice(0, 2);
  const top2Pct = (top2.reduce((s, d) => s + d.tons, 0) / totalTons) * 100;

  // little inline trend arrow for years
  const arrow = (cur: number, prev: number | null) => {
    if (prev == null) return null;
    if (cur > prev + 0.3) return <span className="text-[#0d3d3b]">▲</span>;
    if (cur < prev - 0.3) return <span className="text-stone-500">▼</span>;
    return <span className="text-stone-300">▬</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Strategic KPIs · Margin Engine</p>
        <span className="text-[10px] text-stone-400">click a card to drill down</span>
      </div>

      {/* KPI cards (clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Margin */}
        <button
          onClick={() => setOpen(open === "margin" ? null : "margin")}
          className={`text-left bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] p-4 transition hover:shadow-md ${open === "margin" ? "ring-1 ring-[#0d3d3b]/20" : ""}`}
        >
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Gross Margin</p>
          <p className="text-xl font-bold text-[#0d3d3b]">{formatCurrency(kpi.grossMargin)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{pct(kpi.marginPct)} · {formatCurrency(kpi.marginPerTon)}/t</p>
        </button>

        {/* Revenue */}
        <button
          onClick={() => setOpen(open === "margin" ? null : "margin")}
          className="text-left bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] p-4 transition hover:shadow-md"
        >
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Revenue / Cost</p>
          <p className="text-xl font-bold text-stone-900">{formatCurrency(kpi.revenue)}</p>
          <p className="text-xs text-stone-400 mt-0.5">cost {formatCurrency(kpi.cost)}</p>
        </button>

        {/* Operations */}
        <button
          onClick={() => setOpen(open === "ops" ? null : "ops")}
          className={`text-left bg-white rounded-md shadow-sm border-l-[3px] p-4 transition hover:shadow-md ${open === "ops" ? "border-l-[#0d3d3b] ring-1 ring-[#0d3d3b]/20" : "border-l-[#0d3d3b]"}`}
        >
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Volume</p>
          <p className="text-xl font-bold text-stone-900">{formatNumber(kpi.tons, 0)} <span className="text-sm font-normal text-stone-400">TN</span></p>
          <p className="text-xs text-stone-400 mt-0.5">{kpi.cars} cars · {formatNumber(kpi.avgCar, 1)}t avg</p>
        </button>

        {/* Avg price spread */}
        <button
          onClick={() => setOpen(open === "spread" ? null : "spread")}
          className={`text-left bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] p-4 transition hover:shadow-md ${open === "spread" ? "ring-1 ring-[#0d3d3b]/20" : ""}`}
        >
          <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-1">Avg Price Spread</p>
          <p className="text-xl font-bold text-[#0d3d3b]">
            {formatCurrency(avgSpread)}/t
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            range {formatCurrency(minSpread)}–{formatCurrency(maxSpread)}/t
          </p>
        </button>
      </div>

      {/* Drill-down: Margin by year */}
      {open === "margin" && (
        <div className="bg-white rounded-md shadow-sm border border-stone-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold text-stone-700">Margin by Year</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white">
              <tr className="text-[10px] text-stone-400 uppercase">
                <th className="text-left px-4 py-2 font-medium">Year</th>
                <th className="text-right px-4 py-2 font-medium">Cars</th>
                <th className="text-right px-4 py-2 font-medium">Tons</th>
                <th className="text-right px-4 py-2 font-medium">Revenue</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
                <th className="text-right px-4 py-2 font-medium">Margin</th>
                <th className="text-right px-4 py-2 font-medium">Margin %</th>
                <th className="text-right px-4 py-2 font-medium">$/t</th>
              </tr>
            </thead>
            <tbody>
              {kpi.yearRows.map((y, i) => (
                <tr key={y.yr} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2 text-xs font-medium text-[#0d3d3b]">{y.yr}</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-600">{y.cars}</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-600">{formatNumber(y.tons, 1)}</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-700">{formatCurrency(y.revenue)}</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-500">{formatCurrency(y.cost)}</td>
                  <td className="px-4 py-2 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(y.margin)}</td>
                  <td className="px-4 py-2 text-xs text-right font-medium">
                    {pct(y.marginPct)} {arrow(y.marginPct, i > 0 ? kpi.yearRows[i - 1].marginPct : null)}
                  </td>
                  <td className="px-4 py-2 text-xs text-right text-stone-600">{formatCurrency(y.marginPerTon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down: Operations */}
      {open === "ops" && (
        <div className="bg-white rounded-md shadow-sm border border-stone-100 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Total Cars</p>
            <p className="text-lg font-bold text-stone-900">{kpi.cars}</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Avg Car Size</p>
            <p className="text-lg font-bold text-stone-900">{formatNumber(kpi.avgCar, 2)}t</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Min / Max Car</p>
            <p className="text-lg font-bold text-stone-900">{formatNumber(kpi.minCar, 1)} / {formatNumber(kpi.maxCar, 1)}t</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Top-2 Destination Mix</p>
            <p className="text-lg font-bold text-stone-900">{top2Pct.toFixed(0)}%</p>
            <p className="text-[10px] text-stone-400">{top2.map(d => d.destination).join(" + ")}</p>
          </div>
          <div className="col-span-2 md:col-span-4 mt-1">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-2">Destination concentration</p>
            <div className="space-y-1.5">
              {kpi.destRows.map(d => {
                const w = (d.tons / totalTons) * 100;
                return (
                  <div key={d.destination} className="flex items-center gap-2">
                    <span className="text-xs text-stone-600 w-28 shrink-0">{d.destination}</span>
                    <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0d3d3b] rounded-full" style={{ width: `${w}%` }} />
                    </div>
                    <span className="text-[10px] text-stone-400 w-24 text-right shrink-0">{d.cars} cars · {w.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Drill-down: Spread by PO */}
      {open === "spread" && (
        <div className="bg-white rounded-md shadow-sm border border-stone-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700">Price Spread by PO (sell − buy per ton)</p>
            <p className="text-[10px] text-stone-400">
              avg {formatCurrency(avgSpread)}/t · range {formatCurrency(minSpread)}–{formatCurrency(maxSpread)}/t
            </p>
          </div>
          <div className="p-4 space-y-1.5">
            {kpi.spreadRows.map((s) => {
              const w = maxSpread > 0 ? (s.spread / maxSpread) * 100 : 0;
              const aboveAvg = s.spread >= avgSpread;
              return (
                <div key={s.poNumber} className="flex items-center gap-2">
                  <span className="text-xs text-stone-600 w-16 shrink-0">{s.poNumber}</span>
                  <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${aboveAvg ? "bg-[#0d3d3b]" : "bg-[#0d3d3b]/45"}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#0d3d3b] w-16 text-right shrink-0">
                    {formatCurrency(s.spread)}
                  </span>
                </div>
              );
            })}
            {/* avg reference line note */}
            <div className="flex items-center gap-2 pt-2 mt-1 border-t border-stone-100">
              <span className="text-[10px] text-stone-400 w-16 shrink-0">Average</span>
              <div className="flex-1" />
              <span className="text-xs font-bold text-[#0d3d3b] w-16 text-right shrink-0">
                {formatCurrency(avgSpread)}/t
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
