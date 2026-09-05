"use client";

import { useEffect, useState } from "react";
import { DateField } from "@/components/date-field";

interface ProgramAgg {
  program: string; agent: string; expense: number; count: number;
  byYear: Record<string, number>; sales: number; rate: number | null;
}
interface Payment {
  id: number; date: string; amount: number; program: string; agent: string;
  category: string; subcategory: string | null; description: string;
}
interface Resp {
  from: string | null; to: string | null; totalExpense: number; count: number;
  byProgram: ProgramAgg[]; byYear: Record<string, number>;
  misplaced: { id: number; date: string; amount: number; program: string; subcategory: string | null }[];
  misplacedTotal: number; payments: Payment[];
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function defaultRange() {
  const now = new Date();
  return { from: `${now.getFullYear() - 2}-01-01`, to: `${now.getFullYear()}-12-31` };
}

const ACCENT = ["#0d3d3b", "#2f8a80", "#7bb3aa", "#c2e0da"];

export default function CommissionsPage() {
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to });
    const res = await fetch(`/api/financial/commissions?${qs}`);
    setData(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.from, range.to]);

  const years = data ? Object.keys(data.byYear).sort() : [];
  const maxYear = data ? Math.max(1, ...Object.values(data.byYear)) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Commissions</h1>
        <p className="text-sm text-stone-500">Sales commissions paid, by program and agent (cash basis, from bank transactions).</p>
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

      {loading ? <p className="text-stone-500">Loading…</p> : !data || data.count === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          No commissions in this period.
        </div>
      ) : (
        <>
          {/* Hero total */}
          <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: "linear-gradient(155deg, #12514e, #082826)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Total commissions paid</p>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums mt-1">{usd(data.totalExpense)}</p>
            <p className="text-xs text-white/70 mt-1">{data.count} payments · {data.byProgram.length} programs</p>
          </div>

          {/* Program cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.byProgram.map((p, i) => (
              <div key={p.program} className="relative bg-white rounded-2xl border border-stone-200 shadow-sm p-5 overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: ACCENT[i % ACCENT.length] }} />
                <div className="font-semibold text-stone-800">{p.program}</div>
                <div className="text-xs text-stone-400">{p.agent}</div>
                <div className="mt-3 text-3xl font-extrabold tabular-nums text-[#0d3d3b]">{usd(p.expense)}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">{p.count} payments</div>
                {p.rate != null && (
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-stone-700">{(p.rate * 100).toFixed(1)}%</span>
                    <span className="text-[11px] text-stone-400">of {usd(p.sales)} sales</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* By year */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="font-semibold text-stone-800 mb-3">Commissions by year</div>
            <div className="space-y-2">
              {years.map((yr) => (
                <div key={yr} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-stone-500 tabular-nums">{yr}</span>
                  <div className="flex-1 bg-stone-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(data.byYear[yr] / maxYear) * 100}%`, background: "#2f8a80" }} />
                  </div>
                  <span className="w-28 text-right text-sm font-medium text-stone-700 tabular-nums">{usd(data.byYear[yr])}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Misplaced warning */}
          {data.misplaced.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-stone-700">
              <div className="font-semibold text-stone-800 mb-1">⚠ {data.misplaced.length} commission payments are filed under Distribution, not OpEx ({usd2(data.misplacedTotal)})</div>
              <p className="text-stone-600">Commissions are an operating expense. While these sit in Distribution they inflate owner distributions and understate OpEx, which overstates EBITDA. IDs: {data.misplaced.map((m) => m.id).join(", ")}.</p>
            </div>
          )}

          {/* Payments table */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 font-semibold text-stone-800">Payments</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-stone-50 text-stone-500 text-left">
                  <tr>
                    <th className="px-5 py-2 font-medium">Date</th>
                    <th className="px-5 py-2 font-medium">Program</th>
                    <th className="px-5 py-2 font-medium">Agent</th>
                    <th className="px-5 py-2 font-medium">Category</th>
                    <th className="px-5 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="border-t border-stone-100">
                      <td className="px-5 py-2 text-stone-500 tabular-nums">{p.date}</td>
                      <td className="px-5 py-2 text-stone-700">{p.program}</td>
                      <td className="px-5 py-2 text-stone-500">{p.agent}</td>
                      <td className="px-5 py-2">
                        <span className={p.category === "OpEx" ? "text-stone-500" : "text-amber-700 font-medium"}>{p.category}</span>
                      </td>
                      <td className={`px-5 py-2 text-right font-medium tabular-nums ${p.amount < 0 ? "text-stone-700" : "text-[#2f8a80]"}`}>{usd2(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
