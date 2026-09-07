"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Save, Lock } from "lucide-react";

type Line = "revenue" | "cogs" | "commissions" | "opex_other";
const DRIVERS: Line[] = ["revenue", "cogs", "commissions", "opex_other"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LABEL: Record<Line, string> = { revenue: "Revenue", cogs: "COGS", commissions: "Commissions", opex_other: "Other OpEx" };

interface Scenario { id: number; name: string; year: number; cutoffMonth: number; growthTarget: number }
interface Detail {
  scenario: Scenario;
  lines: { line: Line; month: number; amount: number }[];
  actuals: Record<Line, number[]>;
}

const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

export default function BudgetPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [grid, setGrid] = useState<Record<Line, number[]>>();
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<"plan" | "actual">("plan");
  const now = new Date();
  const [form, setForm] = useState({ name: "", year: now.getFullYear(), cutoffMonth: now.getMonth(), growthTarget: 2 });

  const loadList = useCallback(async () => {
    const res = await fetch("/api/financial/budget/scenarios");
    const rows = await res.json();
    setScenarios(rows);
    if (rows.length && sel === null) setSel(rows[0].id);
  }, [sel]);
  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/financial/budget/scenarios/${id}`);
    const d: Detail = await res.json();
    setDetail(d);
    const g: Record<Line, number[]> = { revenue: Array(12).fill(0), cogs: Array(12).fill(0), commissions: Array(12).fill(0), opex_other: Array(12).fill(0) };
    for (const l of d.lines) g[l.line][l.month - 1] = l.amount;
    setGrid(g);
  }, []);
  useEffect(() => { if (sel != null) loadDetail(sel); }, [sel, loadDetail]);

  async function create() {
    const res = await fetch("/api/financial/budget/scenarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name || (form.cutoffMonth === 0 ? `Annual budget ${form.year}` : `Forecast ${form.year} (${form.cutoffMonth}+${12 - form.cutoffMonth})`) }),
    });
    const scn = await res.json();
    setShowNew(false);
    await loadList();
    setSel(scn.id);
  }
  async function save() {
    if (!grid || sel == null) return;
    setSaving(true);
    const lines = DRIVERS.flatMap((line) => grid[line].map((amount, i) => ({ line, month: i + 1, amount })));
    await fetch(`/api/financial/budget/scenarios/${sel}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
    setSaving(false);
    loadDetail(sel);
  }
  async function remove(id: number) {
    if (!confirm("Delete this scenario?")) return;
    await fetch(`/api/financial/budget/scenarios/${id}`, { method: "DELETE" });
    setSel(null); setDetail(null); loadList();
  }

  function setCell(line: Line, month: number, v: string) {
    if (!grid) return;
    const next = { ...grid, [line]: [...grid[line]] };
    next[line][month - 1] = Number(v.replace(/[^0-9.-]/g, "")) || 0;
    setGrid(next);
  }

  const cutoff = detail?.scenario.cutoffMonth ?? 0;
  const gp = (m: number) => (grid ? grid.revenue[m] - grid.cogs[m] : 0);
  const ebitda = (m: number) => (grid ? gp(m) - grid.commissions[m] - grid.opex_other[m] : 0);
  const rowTotal = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const gpTotal = grid ? rowTotal(grid.revenue) - rowTotal(grid.cogs) : 0;
  const ebitdaTotal = grid ? gpTotal - rowTotal(grid.commissions) - rowTotal(grid.opex_other) : 0;
  const revTotal = grid ? rowTotal(grid.revenue) : 0;

  // --- Budget vs Actual ---
  const A = detail?.actuals;
  const throughIdx = A ? (() => { let last = -1; for (let i = 0; i < 12; i++) if (A.revenue[i] > 0 || A.opex_other[i] > 0) last = i; return last; })() : -1;
  const sumTo = (arr: number[], idx: number) => arr.slice(0, idx + 1).reduce((a, b) => a + b, 0);
  type CmpRow = { label: string; good: "up" | "down"; bMonth: number[]; aMonth: number[] };
  const cmpRows: CmpRow[] = grid && A ? [
    { label: "Revenue", good: "up", bMonth: grid.revenue, aMonth: A.revenue },
    { label: "COGS", good: "down", bMonth: grid.cogs, aMonth: A.cogs },
    { label: "Gross Profit", good: "up", bMonth: grid.revenue.map((r, i) => r - grid.cogs[i]), aMonth: A.revenue.map((r, i) => r - A.cogs[i]) },
    { label: "Commissions", good: "down", bMonth: grid.commissions, aMonth: A.commissions },
    { label: "Other OpEx", good: "down", bMonth: grid.opex_other, aMonth: A.opex_other },
    { label: "EBITDA", good: "up", bMonth: grid.revenue.map((r, i) => r - grid.cogs[i] - grid.commissions[i] - grid.opex_other[i]), aMonth: A.revenue.map((r, i) => r - A.cogs[i] - A.commissions[i] - A.opex_other[i]) },
  ] : [];
  const throughLabel = throughIdx >= 0 ? MONTHS[throughIdx] : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Budget &amp; Forecast</h1>
          <p className="text-sm text-stone-500">Rolling forecast (actuals + projection) and annual budgets. Actual months are locked; forecast months are editable.</p>
        </div>
        <button onClick={() => setShowNew((s) => !s)} className="flex items-center gap-1.5 bg-[#0d3d3b] text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> New scenario
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 grid gap-3 sm:grid-cols-5 items-end">
          <label className="text-xs text-stone-600 sm:col-span-2">Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="auto"
              className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-stone-600">Year
            <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-stone-600">Actuals through
            <select value={form.cutoffMonth} onChange={(e) => setForm({ ...form, cutoffMonth: Number(e.target.value) })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm">
              <option value={0}>None (annual budget)</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} ({i + 1}+{12 - (i + 1)})</option>)}
            </select>
          </label>
          <label className="text-xs text-stone-600">Growth ×
            <input type="number" step="0.1" value={form.growthTarget} onChange={(e) => setForm({ ...form, growthTarget: Number(e.target.value) })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <div className="sm:col-span-5">
            <button onClick={create} className="bg-[#0d3d3b] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90">Create &amp; seed</button>
            <span className="ml-3 text-xs text-stone-400">Forecast months seed from your recent run-rate × growth (Other OpEx stays fixed).</span>
          </div>
        </div>
      )}

      {/* Scenario tabs */}
      {scenarios.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${s.id === sel ? "bg-[#0d3d3b] text-white border-[#0d3d3b]" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
              {s.name}
              <Trash2 className="w-3 h-3 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); remove(s.id); }} />
            </button>
          ))}
        </div>
      )}

      {!detail || !grid ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          {scenarios.length === 0 ? "No scenarios yet. Create your first forecast or annual budget." : "Loading…"}
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(155deg, #12514e, #082826)" }}>
              <p className="text-[11px] uppercase tracking-wider text-white/60 font-bold">Revenue ({detail.scenario.year})</p>
              <p className="text-3xl font-extrabold tabular-nums mt-1">{usd(revTotal)}</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-stone-200">
              <p className="text-[11px] uppercase tracking-wider text-stone-400 font-bold">Gross Profit</p>
              <p className="text-3xl font-extrabold tabular-nums mt-1 text-[#0d3d3b]">{usd(gpTotal)}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{revTotal ? ((gpTotal / revTotal) * 100).toFixed(1) : "0"}% margin</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-stone-200">
              <p className="text-[11px] uppercase tracking-wider text-stone-400 font-bold">EBITDA</p>
              <p className="text-3xl font-extrabold tabular-nums mt-1 text-[#0d3d3b]">{usd(ebitdaTotal)}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{revTotal ? ((ebitdaTotal / revTotal) * 100).toFixed(1) : "0"}% margin</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 w-fit">
            <button onClick={() => setView("plan")} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === "plan" ? "bg-white shadow-sm text-[#0d3d3b]" : "text-stone-500"}`}>Plan (edit)</button>
            <button onClick={() => setView("actual")} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${view === "actual" ? "bg-white shadow-sm text-[#0d3d3b]" : "text-stone-500"}`}>Budget vs Actual</button>
          </div>

          {view === "plan" && (<>
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Months 1–{cutoff || 0} are actuals (locked). Edit the forecast months, then save.</p>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#0d3d3b] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
            </button>
          </div>

          {/* Grid */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium sticky left-0 bg-stone-50 z-10">Line</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} className={`px-2 py-2 text-right font-medium ${i + 1 <= cutoff ? "text-stone-400" : "text-[#0d3d3b]"}`}>{m}{i + 1 <= cutoff ? "" : "*"}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-bold text-stone-700">FY</th>
                </tr>
              </thead>
              <tbody>
                {DRIVERS.map((line) => (
                  <tr key={line} className="border-t border-stone-100">
                    <td className="px-3 py-1.5 text-stone-700 font-medium sticky left-0 bg-white z-10">{LABEL[line]}</td>
                    {grid[line].map((v, i) => {
                      const locked = i + 1 <= cutoff;
                      return (
                        <td key={i} className="px-1 py-1 text-right">
                          {locked ? (
                            <span className="text-stone-400 tabular-nums px-1">{usd(v)}</span>
                          ) : (
                            <input value={Math.round(v)} onChange={(e) => setCell(line, i + 1, e.target.value)}
                              className="w-20 text-right tabular-nums border border-stone-200 rounded px-1 py-0.5 focus:border-[#0d3d3b] focus:outline-none" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right font-semibold text-stone-700 tabular-nums">{usd(rowTotal(grid[line]))}</td>
                  </tr>
                ))}
                {/* Gross Profit */}
                <tr className="border-t-2 border-stone-200 bg-[#f3f8f6]">
                  <td className="px-3 py-1.5 font-bold text-[#0d3d3b] sticky left-0 bg-[#f3f8f6] z-10">Gross Profit</td>
                  {MONTHS.map((_, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums text-[#0d3d3b]">{usd(gp(i))}</td>)}
                  <td className="px-3 py-1.5 text-right font-bold text-[#0d3d3b] tabular-nums">{usd(gpTotal)}</td>
                </tr>
                {/* EBITDA */}
                <tr className="border-t border-stone-200 bg-[#e6f1ee]">
                  <td className="px-3 py-1.5 font-bold text-[#0d3d3b] sticky left-0 bg-[#e6f1ee] z-10">EBITDA</td>
                  {MONTHS.map((_, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums font-semibold text-[#0d3d3b]">{usd(ebitda(i))}</td>)}
                  <td className="px-3 py-1.5 text-right font-extrabold text-[#0d3d3b] tabular-nums">{usd(ebitdaTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-400">* forecast month. Revenue/COGS = accrual (invoices by shipment date); Commissions/Other OpEx = cash (bank). Gross Profit and EBITDA are computed.</p>
          </>)}

          {view === "actual" && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">Budget vs actual results through <b>{throughLabel} {detail.scenario.year}</b> (year-to-date), plus the full-year budget.</p>
              <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-stone-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Line</th>
                      <th className="px-4 py-2 font-medium text-right">Budget (YTD)</th>
                      <th className="px-4 py-2 font-medium text-right">Actual (YTD)</th>
                      <th className="px-4 py-2 font-medium text-right">Variance</th>
                      <th className="px-4 py-2 font-medium text-right">Attainment</th>
                      <th className="px-4 py-2 font-medium text-right">Budget (FY)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmpRows.map((r) => {
                      const bY = sumTo(r.bMonth, throughIdx), aY = sumTo(r.aMonth, throughIdx), bFY = r.bMonth.reduce((a, b) => a + b, 0);
                      const varr = aY - bY;
                      const favorable = r.good === "up" ? varr >= 0 : varr <= 0;
                      const att = bY !== 0 ? (aY / bY) * 100 : 0;
                      const strong = r.label === "Revenue" || r.label === "Gross Profit" || r.label === "EBITDA";
                      return (
                        <tr key={r.label} className={`border-t border-stone-100 ${strong ? "bg-[#f3f8f6]" : ""}`}>
                          <td className={`px-4 py-2 ${strong ? "font-bold text-[#0d3d3b]" : "text-stone-700"}`}>{r.label}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-stone-500">{usd(bY)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium text-stone-800">{usd(aY)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums font-medium ${favorable ? "text-[#2f8a80]" : "text-red-600"}`}>{varr >= 0 ? "+" : ""}{usd(varr)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${favorable ? "text-[#2f8a80]" : "text-red-600"}`}>{att.toFixed(0)}%</td>
                          <td className="px-4 py-2 text-right tabular-nums text-stone-500">{usd(bFY)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Monthly Revenue & EBITDA: budget vs actual */}
              <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-stone-50 text-stone-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-stone-50">Revenue</th>
                      {MONTHS.map((m) => <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-stone-100"><td className="px-3 py-1.5 text-stone-500 sticky left-0 bg-white">Budget</td>{grid.revenue.map((v, i) => <td key={i} className="px-2 py-1.5 text-right tabular-nums text-stone-400">{usd(v)}</td>)}</tr>
                    <tr className="border-t border-stone-100"><td className="px-3 py-1.5 text-stone-700 font-medium sticky left-0 bg-white">Actual</td>{(A ? A.revenue : []).map((v, i) => <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${v > 0 ? "text-stone-800 font-medium" : "text-stone-300"}`}>{v > 0 ? usd(v) : "—"}</td>)}</tr>
                    <tr className="border-t border-stone-100"><td className="px-3 py-1.5 text-stone-500 sticky left-0 bg-white">Var</td>{grid.revenue.map((b, i) => { const a = A ? A.revenue[i] : 0; const d = a > 0 ? a - b : 0; return <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${a > 0 ? (d >= 0 ? "text-[#2f8a80]" : "text-red-600") : "text-stone-300"}`}>{a > 0 ? (d >= 0 ? "+" : "") + usd(d) : "—"}</td>; })}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
