"use client";

import { useEffect, useState } from "react";
import { DateField } from "@/components/date-field";

interface SubAgg { total: number; count: number; vendor: string | null }
interface CatAgg { total: number; count: number; subcategories: Record<string, SubAgg> }
interface SummaryResp { byCategory: Record<string, CatAgg> }

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function defaultRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export default function CapitalPage() {
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState<SummaryResp | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    const res = await fetch(`/api/financial/summary?${qs}`);
    setData(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.from, range.to]);

  const capital = data?.byCategory?.["Capital"];
  const distribution = data?.byCategory?.["Distribution"];

  function renderBlock(title: string, agg: CatAgg | undefined, positiveIsGood: boolean) {
    const subs = agg ? Object.entries(agg.subcategories).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total)) : [];
    return (
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-stone-50 border-b border-stone-100">
          <span className="font-semibold text-stone-800">{title}</span>
          <span className={`font-bold ${(agg?.total ?? 0) >= 0 ? "text-emerald-700" : "text-purple-700"}`}>
            {usd(agg?.total ?? 0)}
          </span>
        </div>
        {subs.length === 0 ? (
          <p className="px-5 py-4 text-stone-400 text-sm">None in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-5 py-2 font-medium">Detail</th>
                <th className="px-5 py-2 font-medium">Member / Counterparty</th>
                <th className="px-5 py-2 font-medium text-right"># Tx</th>
                <th className="px-5 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(([name, s]) => (
                <tr key={name} className="border-t border-stone-100">
                  <td className="px-5 py-2 text-stone-700">{name}</td>
                  <td className="px-5 py-2 text-stone-500">{s.vendor || "—"}</td>
                  <td className="px-5 py-2 text-right text-stone-500">{s.count}</td>
                  <td className={`px-5 py-2 text-right font-medium ${s.total >= 0 ? "text-emerald-700" : "text-purple-700"}`}>
                    {usd(s.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Capital & Distributions</h1>
        <p className="text-sm text-stone-500">Member contributions, distributions, and owner personal use (below-the-line, not P&amp;L).</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-stone-600">From
          <span className="ml-2 inline-block align-middle w-40"><DateField value={range.from} onChange={(v) => setRange({ ...range, from: v })}
            className="border border-stone-300 rounded-lg px-2 py-1 w-full" /></span>
        </label>
        <label className="text-sm text-stone-600">To
          <span className="ml-2 inline-block align-middle w-40"><DateField value={range.to} onChange={(v) => setRange({ ...range, to: v })}
            className="border border-stone-300 rounded-lg px-2 py-1 w-full" /></span>
        </label>
      </div>

      {loading ? <p className="text-stone-500">Loading…</p> : (
        <div className="space-y-5">
          {renderBlock("Capital Contributions", capital, true)}
          {renderBlock("Distributions & Owner Personal Use", distribution, false)}
          <div className="bg-white rounded-xl border border-stone-200 px-5 py-3 flex items-center justify-between">
            <span className="font-semibold text-stone-800">Net Capital Movement</span>
            <span className="font-bold text-stone-800">
              {usd((capital?.total ?? 0) + (distribution?.total ?? 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
