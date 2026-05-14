"use client";

import { useState, useEffect, useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Price = {
  id: number;
  source: string;
  grade: string;
  region: string;
  month: string;
  price: number;
  priceType: string;
  changeValue: number | null;
};

const GRADES = ["NBSK", "SBSK", "BHK"];

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

function Change({ value, price }: { value: number; price: number }) {
  const pct = price - value !== 0 ? (value / (price - value)) * 100 : 0;
  const color = value > 0 ? "text-[#0d3d3b]" : value < 0 ? "text-[#0d3d3b]" : "text-stone-400";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {value > 0 ? "+" : ""}{formatNumber(value, 2)} ({pct > 0 ? "+" : ""}{formatNumber(pct, 1)}%)
    </span>
  );
}

const SOURCES = ["TTO", "RISI"];
const PRICE_TYPES = ["net", "list"];
const REGIONS = ["North America", "Europe", "Asia"];

export default function MarketPricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    source: "TTO", grade: "NBSK", region: "North America",
    month: new Date().toISOString().slice(0, 7),
    price: "", priceType: "net", changeValue: "",
  });

  async function load() {
    const res = await fetch("/api/market-prices");
    if (res.ok) setPrices(await res.json());
    setLoading(false);
  }

  async function savePrice() {
    setSaving(true);
    await fetch("/api/market-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: parseFloat(form.price), changeValue: form.changeValue ? parseFloat(form.changeValue) : null }),
    });
    await load();
    setSaving(false);
    setShowForm(false);
  }

  useEffect(() => { load(); }, []);

  const months = useMemo(() => [...new Set(prices.map(p => p.month))].sort().reverse(), [prices]);
  const currentMonth = months[0] || "";
  const naPrices = prices.filter(p => p.region === "North America");
  const currentPrices = naPrices.filter(p => p.month === currentMonth);

  // Chart data: TTO net prices over time
  const chartMonths = useMemo(() => {
    return [...new Set(naPrices.filter(p => p.source === "TTO" && p.priceType === "net").map(p => p.month))].sort().reverse().slice(0, 12).reverse();
  }, [naPrices]);

  const chartData = useMemo(() => {
    return GRADES.map(grade => ({
      grade,
      data: chartMonths.map(m => naPrices.find(p => p.source === "TTO" && p.grade === grade && p.month === m && p.priceType === "net")?.price || null),
    }));
  }, [naPrices, chartMonths]);

  const allVals = chartData.flatMap(g => g.data.filter(Boolean) as number[]);
  const maxPrice = allVals.length > 0 ? Math.max(...allVals) : 1000;
  const minPrice = allVals.length > 0 ? Math.min(...allVals) : 500;
  const range = maxPrice - minPrice || 1;
  const gradeColors: Record<string, string> = { NBSK: "#0d3d3b", SBSK: "#0d3d3b", BHK: "#6ee7b7" };

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Market Prices</h1>
          <p className="text-sm text-stone-400">TTO & RISI pulp price indices — North America</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#0d3d3b] text-[#6ee7b7] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d3d3b] transition-colors">
          + Add Price
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-stone-800">Add / Update Price</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-stone-400 uppercase">Month</label>
              <input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Source</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1">
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1">
                {GRADES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Type</label>
              <select value={form.priceType} onChange={e => setForm(f => ({ ...f, priceType: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1">
                {PRICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Region</label>
              <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1">
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Price (USD/ADMT)</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase">Change vs prev</label>
              <input type="number" step="0.01" placeholder="0.00" value={form.changeValue}
                onChange={e => setForm(f => ({ ...f, changeValue: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={savePrice} disabled={saving || !form.price}
              className="bg-[#0d3d3b] text-[#6ee7b7] px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-stone-500 px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* TTO Net Prices */}
      {currentMonth && (
        <div>
          <h2 className="text-sm font-medium text-[#0d3d3b] uppercase tracking-wide mb-3">TTO Key Indicators — {monthLabel(currentMonth)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GRADES.map(grade => {
              const p = currentPrices.find(p => p.source === "TTO" && p.grade === grade && p.priceType === "net");
              return (
                <div key={grade} className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-stone-900 text-lg mb-1">{grade}</h3>
                  {p && <p className="text-2xl font-bold text-stone-900">${formatNumber(p.price, 2)}</p>}
                  {p?.changeValue != null && <Change value={p.changeValue} price={p.price} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RISI Prices */}
      {currentMonth && currentPrices.some(p => p.source === "RISI") && (
        <div>
          <h2 className="text-sm font-medium text-[#0d3d3b] uppercase tracking-wide mb-3">RISI (Fastmarkets) — {monthLabel(currentMonth)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GRADES.map(grade => {
              const list = currentPrices.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "list");
              const net = currentPrices.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "net");
              if (!list && !net) return null;
              return (
                <div key={grade} className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="font-bold text-stone-900 text-lg mb-2">{grade}</h3>
                  {list && (
                    <div className="mb-3">
                      <p className="text-[10px] text-stone-400 uppercase">List Price</p>
                      <p className="text-2xl font-bold text-stone-900">${formatNumber(list.price, 2)}</p>
                      {list.changeValue != null && <Change value={list.changeValue} price={list.price} />}
                    </div>
                  )}
                  {net && (
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Net Price</p>
                      <p className="text-2xl font-bold text-stone-900">${formatNumber(net.price, 2)}</p>
                      {net.changeValue != null && <Change value={net.changeValue} price={net.price} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TTO Net Price Trend Chart */}
      {chartMonths.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-medium text-stone-700 mb-4">TTO Net Price Trend (USD/ADMT)</h2>
          <div className="flex items-center gap-4 mb-3">
            {GRADES.map(g => (
              <div key={g} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: gradeColors[g] }} />
                <span className="text-stone-600">{g}</span>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 800 320" className="w-full h-72" onMouseLeave={() => setHoverIdx(null)}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = 280 - pct * 250;
              const val = minPrice + pct * range;
              return (
                <g key={pct}>
                  <line x1="50" y1={y} x2="780" y2={y} stroke="#e7e5e4" strokeWidth="1" />
                  <text x="45" y={y + 4} textAnchor="end" fontSize="10" fill="#a8a29e">${Math.round(val)}</text>
                </g>
              );
            })}
            {/* X axis labels */}
            {chartMonths.map((m, i) => {
              const x = 50 + (i / (chartMonths.length - 1)) * 730;
              return <text key={m} x={x} y={310} textAnchor="middle" fontSize="10" fill={hoverIdx === i ? "#1c1917" : "#a8a29e"} fontWeight={hoverIdx === i ? "bold" : "normal"}>{monthLabel(m)}</text>;
            })}
            {/* Lines */}
            {chartData.map(({ grade, data }) => {
              const points = data.map((p, i) => {
                if (p === null) return null;
                const x = 50 + (i / (chartMonths.length - 1)) * 730;
                const y = 280 - ((p - minPrice) / range) * 250;
                return `${x},${y}`;
              }).filter(Boolean);
              return (
                <g key={grade}>
                  <polyline fill="none" stroke={gradeColors[grade]} strokeWidth="2.5" points={points.join(" ")} />
                  {data.map((p, i) => {
                    if (p === null) return null;
                    const x = 50 + (i / (chartMonths.length - 1)) * 730;
                    const y = 280 - ((p - minPrice) / range) * 250;
                    const isHovered = hoverIdx === i;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={isHovered ? 6 : 3.5} fill={gradeColors[grade]} stroke={isHovered ? "white" : "none"} strokeWidth={isHovered ? 2 : 0} />
                        {isHovered && (
                          <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="bold" fill={gradeColors[grade]}>
                            ${formatNumber(p, 2)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {/* Hover vertical line */}
            {hoverIdx !== null && (() => {
              const x = 50 + (hoverIdx / (chartMonths.length - 1)) * 730;
              return <line x1={x} y1={30} x2={x} y2={280} stroke="#a8a29e" strokeWidth="1" strokeDasharray="4 2" />;
            })()}
            {/* Invisible hover zones for each month */}
            {chartMonths.map((_, i) => {
              const x = 50 + (i / (chartMonths.length - 1)) * 730;
              const w = 730 / (chartMonths.length - 1);
              return (
                <rect key={i} x={x - w / 2} y={0} width={w} height={300} fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)} />
              );
            })}
          </svg>
        </div>
      )}

      {/* Full Price Table */}
      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-medium text-muted-foreground">Price History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Month</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Source</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Grade</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Price (USD/ADMT)</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Change</th>
              </tr>
            </thead>
            <tbody>
              {naPrices.slice(0, 50).map(p => (
                <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                  <td className="p-3 text-sm border-t border-border font-medium">{monthLabel(p.month)}</td>
                  <td className="p-3 text-sm border-t border-border">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.source === "TTO" ? "bg-[#ccfbf1] text-[#0d3d3b]" : "bg-[#0d3d3b] text-[#6ee7b7]"}`}>{p.source}</span>
                  </td>
                  <td className="p-3 text-sm border-t border-border font-medium">{p.grade}</td>
                  <td className="p-3 text-sm border-t border-border">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.priceType === "list" ? "bg-[#ccfbf1] text-[#0d3d3b]" : "bg-stone-100 text-stone-500"}`}>{p.priceType}</span>
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right font-medium">${formatNumber(p.price, 2)}</td>
                  <td className="p-3 text-sm border-t border-border text-right">
                    {p.changeValue != null && (
                      <span className={`text-sm font-medium ${p.changeValue > 0 ? "text-[#0d3d3b]" : p.changeValue < 0 ? "text-[#0d3d3b]" : "text-muted-foreground"}`}>
                        {p.changeValue > 0 ? "+" : ""}{formatNumber(p.changeValue, 2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
