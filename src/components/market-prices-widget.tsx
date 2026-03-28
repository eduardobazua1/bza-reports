"use client";

import { formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";

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
const gradeColors: Record<string, string> = { NBSK: "#3b82f6", SBSK: "#f59e0b", BHK: "#10b981" };

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

export function MarketPricesWidget({ prices }: { prices: Price[] }) {
  if (prices.length === 0) return null;

  const months = [...new Set(prices.map(p => p.month))].sort().reverse();
  const currentMonth = months[0];
  const naPrices = prices.filter(p => p.region === "North America");
  const current = naPrices.filter(p => p.month === currentMonth);
  const prev = naPrices.filter(p => p.month === prevMonth(currentMonth));

  // Chart: last 12 months TTO net
  const chartMonths = months
    .filter(m => naPrices.some(p => p.month === m && p.source === "TTO" && p.priceType === "net"))
    .slice(0, 12)
    .reverse();

  const chartData = GRADES.map(grade => ({
    grade,
    data: chartMonths.map(m => {
      const p = naPrices.find(pr => pr.source === "TTO" && pr.grade === grade && pr.month === m && pr.priceType === "net");
      return p?.price || null;
    }),
  }));

  const allVals = chartData.flatMap(g => g.data.filter(Boolean) as number[]);
  const maxP = Math.max(...allVals, 1);
  const minP = Math.min(...allVals, 0);
  const range = maxP - minP || 1;

  return (
    <Link href="/market-prices" className="bg-white rounded-md shadow-sm p-4 block hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Market Prices — {monthLabel(currentMonth)}</p>
          <p className="text-[10px] text-stone-300">TTO & RISI · North America · USD/ADMT</p>
        </div>
      </div>

      {/* Price cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {GRADES.map(grade => {
          const tto = current.find(p => p.source === "TTO" && p.grade === grade && p.priceType === "net");
          const ttoP = prev.find(p => p.source === "TTO" && p.grade === grade && p.priceType === "net");
          const change = tto && ttoP ? tto.price - ttoP.price : null;
          const risiNet = current.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "net");
          const risiList = current.find(p => p.source === "RISI" && p.grade === grade && p.priceType === "list");

          return (
            <div key={grade} className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gradeColors[grade] }} />
                <span className="text-xs font-bold text-stone-700">{grade}</span>
              </div>
              {tto && <p className="text-lg font-bold text-stone-900">${formatNumber(tto.price, 0)}</p>}
              {change !== null && (
                <div className={`flex items-center justify-center gap-0.5 text-[10px] font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-stone-400"}`}>
                  {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {change > 0 ? "+" : ""}{formatNumber(change, 1)}
                </div>
              )}
              <div className="mt-1 space-y-0.5 text-[10px] text-stone-400">
                {risiList && <p>RISI List: ${formatNumber(risiList.price, 0)}</p>}
                {risiNet && <p>RISI Net: ${formatNumber(risiNet.price, 0)}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini chart */}
      {chartMonths.length > 1 && (
        <svg viewBox="0 0 600 120" className="w-full h-20">
          {chartMonths.map((m, i) => {
            if (i % 3 !== 0 && i !== chartMonths.length - 1) return null;
            const x = 30 + (i / (chartMonths.length - 1)) * 550;
            return <text key={m} x={x} y={118} textAnchor="middle" fontSize="9" fill="#a8a29e">{monthLabel(m)}</text>;
          })}
          {chartData.map(({ grade, data }) => {
            const points = data.map((p, i) => {
              if (p === null) return null;
              const x = 30 + (i / (chartMonths.length - 1)) * 550;
              const y = 100 - ((p - minP) / range) * 90;
              return `${x},${y}`;
            }).filter(Boolean);
            return <polyline key={grade} fill="none" stroke={gradeColors[grade]} strokeWidth="2" points={points.join(" ")} />;
          })}
        </svg>
      )}
    </Link>
  );
}
