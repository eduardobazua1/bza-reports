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
  const color = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-500" : "text-stone-400";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {value > 0 ? "+" : ""}{formatNumber(value, 2)} ({pct > 0 ? "+" : ""}{formatNumber(pct, 1)}%)
    </span>
  );
}

export default function MarketPricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/market-prices");
    if (res.ok) setPrices(await res.json());
    setLoading(false);
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
  const gradeColors: Record<string, string> = { NBSK: "#3b82f6", SBSK: "#f59e0b", BHK: "#10b981" };

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Market Prices</h1>
        <p className="text-sm text-stone-400">TTO & RISI pulp price indices — North America</p>
      </div>

      {/* TTO Net Prices */}
      {currentMonth && (
        <div>
          <h2 className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-3">TTO Key Indicators — {monthLabel(currentMonth)}</h2>
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
          <h2 className="text-sm font-medium text-purple-600 uppercase tracking-wide mb-3">RISI (Fastmarkets) — {monthLabel(currentMonth)}</h2>
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
                      <p className="text-xl font-bold text-stone-900">${formatNumber(list.price, 0)}</p>
                      {list.changeValue != null && (
                        <span className={`text-xs font-medium ${list.changeValue > 0 ? "text-emerald-600" : list.changeValue < 0 ? "text-red-500" : "text-stone-400"}`}>
                          {list.changeValue > 0 ? "+" : ""}{formatNumber(list.changeValue, 0)}
                        </span>
                      )}
                    </div>
                  )}
                  {net && (
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase">Net Price</p>
                      <p className="text-xl font-bold text-stone-900">${formatNumber(net.price, 0)}</p>
                      {net.changeValue != null && (
                        <span className={`text-xs font-medium ${net.changeValue > 0 ? "text-emerald-600" : net.changeValue < 0 ? "text-red-500" : "text-stone-400"}`}>
                          {net.changeValue > 0 ? "+" : ""}{formatNumber(net.changeValue, 0)}
                        </span>
                      )}
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
          <svg viewBox="0 0 800 300" className="w-full h-64">
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = 280 - pct * 250;
              const val = minPrice + pct * range;
              return (
                <g key={pct}>
                  <line x1="50" y1={y} x2="780" y2={y} stroke="#e7e5e4" strokeWidth="1" />
                  <text x="45" y={y + 4} textAnchor="end" className="text-[10px]" fill="#a8a29e">${Math.round(val)}</text>
                </g>
              );
            })}
            {chartMonths.map((m, i) => {
              const x = 50 + (i / (chartMonths.length - 1)) * 730;
              return <text key={m} x={x} y={298} textAnchor="middle" className="text-[10px]" fill="#a8a29e">{monthLabel(m)}</text>;
            })}
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
                    return <circle key={i} cx={x} cy={y} r="3.5" fill={gradeColors[grade]} />;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Full Price Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <h2 className="text-sm font-medium text-stone-700">Price History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Grade</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Price (USD/ADMT)</th>
                <th className="px-4 py-3 text-right">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {naPrices.slice(0, 50).map(p => (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-medium text-stone-800">{monthLabel(p.month)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.source === "TTO" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>{p.source}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-stone-700">{p.grade}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.priceType === "list" ? "bg-amber-50 text-amber-600" : "bg-stone-100 text-stone-500"}`}>{p.priceType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-stone-900">${formatNumber(p.price, 2)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.changeValue != null && (
                      <span className={`text-xs font-medium ${p.changeValue > 0 ? "text-emerald-600" : p.changeValue < 0 ? "text-red-500" : "text-stone-400"}`}>
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
