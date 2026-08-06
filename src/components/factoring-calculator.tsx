"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

const SPREAD = 1.35; // JP Morgan spread over SOFR, per the KC program

export type FactoringRow = {
  id: number;
  invoiceNumber: string;
  poNumber: string | null;
  amount: number;
  shipmentDate: string | null;
  dueDate: string | null;
};

// Days between today and a due date (0 if at/past due).
function daysToDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = Math.round((due.getTime() - today.getTime()) / 86400000);
  return Math.max(0, d);
}

export function FactoringCalculator({ rows }: { rows: FactoringRow[] }) {
  const [sofr, setSofr] = useState(4.3);
  const [sofrInfo, setSofrInfo] = useState<{ date: string | null; source: "live" | "manual" | "saved" }>({ date: null, source: "saved" });

  // Pull the live SOFR from the NY Fed on load; fall back to the last saved value if unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/sofr");
        if (r.ok) {
          const d = await r.json();
          if (!cancelled && typeof d.rate === "number") { setSofr(d.rate); setSofrInfo({ date: d.date ?? null, source: "live" }); return; }
        }
      } catch { /* offline — use saved */ }
      if (!cancelled) {
        const saved = localStorage.getItem("bza-sofr");
        if (saved) { setSofr(Number(saved)); setSofrInfo({ date: null, source: "saved" }); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist the active rate so it's a fallback if the NY Fed is unreachable next time.
  useEffect(() => { localStorage.setItem("bza-sofr", String(sofr)); }, [sofr]);

  function onSofrChange(v: number) { setSofr(v); setSofrInfo((i) => ({ ...i, source: "manual" })); }

  const rate = (sofr + SPREAD) / 100; // effective annual discount rate

  const computed = useMemo(() => {
    return rows.map((r) => {
      const days = daysToDue(r.dueDate);
      // Cost is proportional to days advanced. At/after due date → 0 (nothing to discount).
      const cost = days === null ? null : r.amount * rate * (days / 360);
      const net = cost === null ? null : r.amount - cost;
      const costPct = cost === null ? null : (cost / r.amount) * 100;
      return { ...r, days, cost, net, costPct };
    });
  }, [rows, rate]);

  const totals = useMemo(() => {
    let face = 0, cost = 0, net = 0, eligible = 0, noDate = 0, atDue = 0;
    for (const r of computed) {
      face += r.amount;
      if (r.days === null) { noDate++; continue; }
      if (r.days === 0) atDue++;
      eligible += r.amount;
      cost += r.cost ?? 0;
      net += r.net ?? 0;
    }
    return { face, cost, net, eligible, noDate, atDue };
  }, [computed]);

  return (
    <div className="space-y-5">
      {/* Rate controls + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Discount rate</p>
          <div className="flex items-baseline gap-1 mt-2">
            <input
              type="number"
              step="0.01"
              value={sofr}
              onChange={(e) => onSofrChange(Number(e.target.value))}
              className="w-20 text-2xl font-extrabold text-[#0d3d3b] border-b border-stone-200 focus:outline-none focus:border-[#0d3d3b] tabular-nums"
            />
            <span className="text-sm text-stone-500 font-semibold">% SOFR</span>
          </div>
          <p className="text-xs text-stone-400 mt-1">+ {SPREAD}% spread = <span className="font-bold text-stone-700">{(sofr + SPREAD).toFixed(2)}%</span> annual</p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            {sofrInfo.source === "live" && sofrInfo.date ? <>Live · NY Fed as of {formatDate(sofrInfo.date)}</>
              : sofrInfo.source === "manual" ? "Manual override (simulation)"
              : "Saved rate — couldn't reach NY Fed"}
          </p>
        </div>
        <SummaryTile label="Open KC receivable" value={formatCurrency(totals.face)} sub={`${rows.length} invoices`} />
        <SummaryTile label="Total discount cost" value={formatCurrency(totals.cost)} sub={totals.face > 0 ? `${((totals.cost / totals.eligible) * 100 || 0).toFixed(2)}% of eligible` : ""} />
        <SummaryTile label="Cash if discounted today" value={formatCurrency(totals.net)} sub={`on ${formatCurrency(totals.eligible)} eligible`} accent />
      </div>

      <p className="text-xs text-stone-400">
        Cost = amount × ({(sofr + SPREAD).toFixed(2)}% ÷ 360) × days to due. The further the due date, the more it costs to advance; near the due date the cost approaches $0. JP Morgan Supply Chain Finance — Kimberly-Clark program only.
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-medium uppercase tracking-wide text-stone-400 border-b border-stone-100">
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">PO</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Due date</th>
                <th className="px-3 py-2 text-right">Days left</th>
                <th className="px-3 py-2 text-right">Discount cost</th>
                <th className="px-3 py-2 text-right">Net today</th>
              </tr>
            </thead>
            <tbody>
              {computed.map((r) => (
                <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="px-3 py-1.5 font-medium text-stone-800 whitespace-nowrap">{r.invoiceNumber}</td>
                  <td className="px-3 py-1.5 text-stone-500">{r.poNumber ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">{formatCurrency(r.amount)}</td>
                  <td className="px-3 py-1.5 text-stone-500 whitespace-nowrap">{r.dueDate ? formatDate(r.dueDate) : <span className="text-stone-400">no date</span>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.days === null ? "—" : r.days === 0
                      ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">at due</span>
                      : <span className="text-stone-700">{r.days}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.cost === null ? "—" : (
                      <span className="text-stone-600">
                        {formatCurrency(r.cost)}<span className="text-[10px] text-stone-400"> · {(r.costPct ?? 0).toFixed(2)}%</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[#0d3d3b]">{r.net === null ? "—" : formatCurrency(r.net)}</td>
                </tr>
              ))}
              {computed.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No open Kimberly-Clark invoices.</td></tr>
              )}
            </tbody>
            {computed.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-stone-200 font-bold text-stone-800">
                  <td className="px-3 py-2" colSpan={2}>Total ({rows.length})</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.face)}</td>
                  <td colSpan={2}></td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-600">{formatCurrency(totals.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#0d3d3b]">{formatCurrency(totals.net)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`text-2xl font-extrabold mt-1.5 tabular-nums ${accent ? "text-[#1c6b66]" : "text-stone-800"}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}
