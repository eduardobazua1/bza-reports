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
};

const GRADES = ["NBSK", "SBSK", "BHK"];

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

function prevMonth(m: string) {
  const d = new Date(m + "-01");
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
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

  // Get unique months sorted descending
  const months = useMemo(() => [...new Set(prices.map(p => p.month))].sort().reverse(), [prices]);
  const currentMonth = months[0] || "";

  // Current vs previous month comparison
  const currentPrices = prices.filter(p => p.month === currentMonth && p.region === "North America");
  const prevPrices = prices.filter(p => p.month === prevMonth(currentMonth) && p.region === "North America");

  function getChange(source: string, grade: string, type: string) {
    const curr = currentPrices.find(p => p.source === source && p.grade === grade && p.priceType === type);
    const prev = prevPrices.find(p => p.source === source && p.grade === grade && p.priceType === type);
    if (!curr || !prev) return null;
    return { value: curr.price - prev.price, pct: ((curr.price - prev.price) / prev.price) * 100 };
  }

  // Chart data: last 12 months for TTO net prices
  const chartMonths = months.slice(0, 12).reverse();
  const chartData = useMemo(() => {
    return GRADES.map(grade => ({
      grade,
      data: chartMonths.map(m => {
        const p = prices.find(pr => pr.source === "TTO" && pr.grade === grade && pr.month === m && pr.priceType === "net" && pr.region === "North America");
        return p?.price || null;
      }),
    }));
  }, [prices, chartMonths]);

  const maxPrice = Math.max(...chartData.flatMap(g => g.data.filter(Boolean) as number[]), 1);
  const minPrice = Math.min(...chartData.flatMap(g => g.data.filter(Boolean) as number[]), 0);
  const range = maxPrice - minPrice || 1;

  const gradeColors: Record<string, string> = { NBSK: "#3b82f6", SBSK: "#f59e0b", BHK: "#10b981" };

  if (loading) return <div className="p-8 text-stone-400">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Market Prices</h1>
          <p className="text-sm text-stone-400">TTO & RISI pulp price indices — North America</p>
        </div>
      </div>

      {/* Current Month Summary Cards */}
      {currentMonth && (
        <div>
          <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wide mb-3">{monthLabel(currentMonth)} — vs {monthLabel(prevMonth(currentMonth))}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GRADES.map(grade => {
              const ttoNet = currentPrices.find(p => p.source === "TTO" && p.grade === grade && p.priceType === "net");
              const risiList = currentPrices.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "list");
              const risiNet = currentPrices.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "net");
              const ttoChange = getChange("TTO", grade, "net");

              return (
                <div key={grade} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-stone-900 text-lg">{grade}</h3>
                    {ttoChange && (
                      <span className={`flex items-center gap-1 text-sm font-medium ${ttoChange.value > 0 ? "text-emerald-600" : ttoChange.value < 0 ? "text-red-500" : "text-stone-400"}`}>
                        {ttoChange.value > 0 ? <TrendingUp className="w-4 h-4" /> : ttoChange.value < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        {ttoChange.value > 0 ? "+" : ""}{formatNumber(ttoChange.value, 2)} ({ttoChange.pct > 0 ? "+" : ""}{formatNumber(ttoChange.pct, 1)}%)
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    {ttoNet && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">TTO Net</span>
                        <span className="font-semibold text-stone-900">${formatNumber(ttoNet.price, 2)}</span>
                      </div>
                    )}
                    {risiList && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">RISI List</span>
                        <span className="font-semibold text-stone-900">${formatNumber(risiList.price, 2)}</span>
                      </div>
                    )}
                    {risiNet && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">RISI Net</span>
                        <span className="font-semibold text-stone-900">${formatNumber(risiNet.price, 2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TTO Net Price Trend Chart (SVG) */}
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
            {/* Grid lines */}
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
            {/* X axis labels */}
            {chartMonths.map((m, i) => {
              const x = 50 + (i / (chartMonths.length - 1)) * 730;
              return <text key={m} x={x} y={298} textAnchor="middle" className="text-[10px]" fill="#a8a29e">{monthLabel(m)}</text>;
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
          <h2 className="text-sm font-medium text-stone-700">All Prices</h2>
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
                <th className="px-4 py-3 text-right">vs Prev Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {prices.filter(p => p.region === "North America").slice(0, 50).map(p => {
                const prev = prices.find(pr => pr.source === p.source && pr.grade === p.grade && pr.priceType === p.priceType && pr.region === p.region && pr.month === prevMonth(p.month));
                const change = prev ? p.price - prev.price : null;
                return (
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
                      {change !== null && (
                        <span className={`text-xs font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-stone-400"}`}>
                          {change > 0 ? "+" : ""}{formatNumber(change, 2)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
