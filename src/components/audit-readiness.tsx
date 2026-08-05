"use client";

import { useMemo, useState } from "react";
import { Check, X, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import type { ReadinessRow } from "@/lib/coc-audit";

// Per-operation audit-readiness: documental completeness (BL + PL + supplier invoice)
// combined with the claim-validation status. Green = audit-ready, amber = pending
// customer verification, red = missing docs or claim not supported.
type Level = "ready" | "pending" | "attention";
function levelOf(r: ReadinessRow): Level {
  if (!r.docComplete || r.auditValidation === "Review Required" || r.auditValidation === "Document Missing") return "attention";
  if (r.auditValidation === "Pending Customer Verification") return "pending";
  return "ready";
}
const LEVEL_STYLE: Record<Level, string> = {
  ready: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  attention: "bg-red-100 text-red-700",
};
const LEVEL_LABEL: Record<Level, string> = { ready: "Audit-ready", pending: "Pending customer", attention: "Needs attention" };

function Dot({ ok }: { ok: boolean }) {
  return ok
    ? <Check className="w-3.5 h-3.5 text-emerald-600 inline" />
    : <X className="w-3.5 h-3.5 text-red-500 inline" />;
}

export function AuditReadiness({ rows }: { rows: ReadinessRow[] }) {
  const [onlyIssues, setOnlyIssues] = useState(false);

  const withLevel = useMemo(() => rows.map((r) => ({ r, level: levelOf(r) })), [rows]);
  const counts = useMemo(() => {
    const c = { ready: 0, pending: 0, attention: 0, docComplete: 0 };
    for (const { r, level } of withLevel) { c[level]++; if (r.docComplete) c.docComplete++; }
    return c;
  }, [withLevel]);

  // Attention first, then pending, then ready.
  const order: Record<Level, number> = { attention: 0, pending: 1, ready: 2 };
  const shown = useMemo(() => {
    const list = onlyIssues ? withLevel.filter((x) => x.level !== "ready") : withLevel;
    return [...list].sort((a, b) => order[a.level] - order[b.level]);
  }, [withLevel, onlyIssues]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-stone-800">Audit readiness by operation</p>
          <p className="text-xs text-stone-400">Each shipment: supplier invoice + BL + PL attached, and the claim validated end-to-end.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Show only items needing attention
        </label>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 my-3">
        <Kpi icon={ShieldCheck} cls="text-emerald-600 bg-emerald-50" label="Audit-ready" value={counts.ready} />
        <Kpi icon={Clock} cls="text-amber-600 bg-amber-50" label="Pending customer" value={counts.pending} />
        <Kpi icon={AlertTriangle} cls="text-red-600 bg-red-50" label="Needs attention" value={counts.attention} />
        <Kpi icon={Check} cls="text-stone-600 bg-stone-50" label="Docs complete" value={`${counts.docComplete}/${rows.length}`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="py-2 pr-2">Invoice</th><th className="pr-2">PO</th><th className="pr-2">Customer</th>
              <th className="pr-2">Scheme</th><th className="pr-2 text-center">Sup. inv.</th>
              <th className="pr-2 text-center">BL</th><th className="pr-2 text-center">PL</th>
              <th className="pr-2">Claim</th><th className="pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, level }) => (
              <tr key={r.bzaInvoice} className="border-b border-stone-50">
                <td className="py-1.5 pr-2 font-medium text-stone-700">
                  <a href={`/api/invoice-pdf?invoice=${encodeURIComponent(r.bzaInvoice)}`} target="_blank" rel="noopener noreferrer" className="text-[#0d3d3b] hover:underline">{r.bzaInvoice}</a>
                </td>
                <td className="pr-2 text-stone-500">{r.po}</td>
                <td className="pr-2 text-stone-500 max-w-[160px] truncate" title={r.customer}>{r.customer}</td>
                <td className="pr-2">{r.scheme === "No Claim" ? <span className="text-stone-400">None</span> : r.scheme}</td>
                <td className="pr-2 text-center"><Dot ok={r.hasSupplierInvoice} /></td>
                <td className="pr-2 text-center"><Dot ok={r.hasBL} /></td>
                <td className="pr-2 text-center"><Dot ok={r.hasPL} /></td>
                <td className="pr-2 text-stone-500 max-w-[150px] truncate" title={r.outputClaim}>{r.outputClaim}</td>
                <td className="pr-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}</span></td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-stone-400">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, cls, label, value }: { icon: typeof Check; cls: string; label: string; value: number | string }) {
  return (
    <div className={`rounded-lg p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
