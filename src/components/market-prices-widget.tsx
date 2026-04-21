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
  changeValue: number | null;
};

const GRADES = ["NBSK", "SBSK", "BHK"];
const gradeColors: Record<string, string> = { NBSK: "#3b82f6", SBSK: "#f59e0b", BHK: "#10b981" };

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

function Change({ value, price }: { value: number; price: number }) {
  const pct = price > 0 ? (value / (price - value)) * 100 : 0;
  const color = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-500" : "text-stone-400";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {value > 0 ? "+" : ""}{formatNumber(value, 2)} ({pct > 0 ? "+" : ""}{formatNumber(pct, 1)}%)
    </span>
  );
}

export function MarketPricesWidget({ prices }: { prices: Price[] }) {
  if (prices.length === 0) return null;

  const na = prices.filter(p => p.region === "North America");
  const months = [...new Set(na.map(p => p.month))].sort().reverse();
  const curr = months[0];

  function getPrice(source: string, grade: string, type: string) {
    return na.find(p => p.source === source && p.grade === grade && p.priceType === type && p.month === curr);
  }

  // Chart: last 12 months TTO net
  const ttoMonths = [...new Set(na.filter(p => p.source === "TTO" && p.priceType === "net").map(p => p.month))].sort().reverse().slice(0, 12).reverse();
  const chartData = GRADES.map(grade => ({
    grade,
    data: ttoMonths.map(m => na.find(p => p.source === "TTO" && p.grade === grade && p.month === m && p.priceType === "net")?.price || null),
  }));
  const allVals = chartData.flatMap(g => g.data.filter(Boolean) as number[]);
  const maxP = allVals.length > 0 ? Math.max(...allVals) : 1000;
  const minP = allVals.length > 0 ? Math.min(...allVals) : 500;
  const range = maxP - minP || 1;

  return (
    <Link href="/market-prices" className="bg-white rounded-md shadow-sm p-4 block hover:shadow-md transition-shadow">
      <div className="mb-4">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Market Prices — {monthLabel(curr)}</p>
        <p className="text-[10px] text-stone-300">North America · USD/ADMT · Click for details</p>
      </div>

      {/* TTO Section */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-[#0d9488] uppercase tracking-wide mb-2">TTO Net</p>
        <div className="grid grid-cols-3 gap-3">
          {GRADES.map(grade => {
            const p = getPrice("TTO", grade, "net");
            return (
              <div key={grade} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gradeColors[grade] }} />
                  <span className="text-xs font-bold text-stone-700">{grade}</span>
                </div>
                {p && <p className="text-lg font-bold text-stone-900">${formatNumber(p.price, 2)}</p>}
                {p?.changeValue != null && <Change value={p.changeValue} price={p.price} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* RISI Section */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide mb-2">RISI (Fastmarkets)</p>
        <div className="grid grid-cols-3 gap-3">
          {GRADES.map(grade => {
            const list = getPrice("RISI", grade, "list");
            const net = getPrice("RISI", grade, "net");
            return (
              <div key={grade} className="text-center">
                <span className="text-xs font-bold text-stone-700">{grade}</span>
                {list && (
                  <div className="mt-0.5">
                    <p className="text-[10px] text-stone-400">List</p>
                    <p className="text-sm font-bold text-stone-900">${formatNumber(list.price, 0)}</p>
                    {list.changeValue != null && <Change value={list.changeValue} price={list.price} />}
                  </div>
                )}
                {net && (
                  <div className="mt-0.5">
                    <p className="text-[10px] text-stone-400">Net</p>
                    <p className="text-sm font-bold text-stone-900">${formatNumber(net.price, 0)}</p>
                    {net.changeValue != null && <Change value={net.changeValue} price={net.price} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </Link>
  );
}
