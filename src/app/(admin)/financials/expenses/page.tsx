"use client";

import { useEffect, useState } from "react";
import { DateField } from "@/components/date-field";

interface SubAgg { total: number; count: number; vendor: string | null }
interface CatAgg { total: number; count: number; subcategories: Record<string, SubAgg> }
interface SummaryResp { from: string | null; to: string | null; byCategory: Record<string, CatAgg> }

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function defaultRange() {
  const now = new Date();
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export default function ExpensesPage() {
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

  const opex = data?.byCategory?.["OpEx"];
  const subs = opex ? Object.entries(opex.subcategories).sort((a, b) => a[1].total - b[1].total) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Operating Expenses</h1>
        <p className="text-sm text-stone-500">Categorized OpEx from imported bank transactions (cash basis).</p>
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

      {loading ? <p className="text-stone-500">Loading…</p> : !opex ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          No operating expenses in this period. Import bank statements first.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
            <span className="font-semibold text-stone-800">Total Operating Expenses</span>
            <span className="font-bold text-rose-700">{usd(opex.total)}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-5 py-2 font-medium">Category</th>
                <th className="px-5 py-2 font-medium">Vendor</th>
                <th className="px-5 py-2 font-medium text-right"># Tx</th>
                <th className="px-5 py-2 font-medium text-right">Amount</th>
                <th className="px-5 py-2 font-medium text-right">% of OpEx</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(([name, s]) => (
                <tr key={name} className="border-t border-stone-100">
                  <td className="px-5 py-2 text-stone-700">{name}</td>
                  <td className="px-5 py-2 text-stone-500">{s.vendor || "—"}</td>
                  <td className="px-5 py-2 text-right text-stone-500">{s.count}</td>
                  <td className="px-5 py-2 text-right font-medium text-rose-700">{usd(s.total)}</td>
                  <td className="px-5 py-2 text-right text-stone-500">
                    {opex.total !== 0 ? ((s.total / opex.total) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
