"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Mail, X, Check, Settings2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type BucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d91plus";

export type ARRow = {
  name: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d91plus: number;
  total: number;
};

export type ARTotals = {
  current: number; d1_30: number; d31_60: number; d61_90: number; d91plus: number; total: number;
};

const BUCKET_MAP: Record<BucketKey, string> = {
  current: "current", d1_30: "d1_30", d31_60: "d31_60", d61_90: "d61_90", d91plus: "over91",
};

const ALL_COLS: { key: BucketKey; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30",   label: "1 - 30" },
  { key: "d31_60",  label: "31 - 60" },
  { key: "d61_90",  label: "61 - 90" },
  { key: "d91plus", label: "91 And Over" },
];

const STORAGE_KEY = "bza_cols_ar-aging-summary";

type ToastState = { message: string; type: "success" | "error" } | null;

// ─── Email modal ──────────────────────────────────────────────────────────────
function EmailModal({ onClose, onSend, isSending }: {
  onClose: () => void;
  onSend: (to: string, subject: string, message: string) => void;
  isSending: boolean;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("A/R Aging Summary — BZA International Services");
  const [message, setMessage] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Send Report by Email</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSend(to.trim(), subject, message); }} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">To <span className="text-red-500">*</span></label>
            <input type="email" value={to} onChange={e => setTo(e.target.value)} required placeholder="recipient@example.com"
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Message <span className="text-stone-400">(optional)</span></label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSending || !to.trim()}
              className="px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50">
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────
export function ARAgingSummaryClient({ rows, totals, asOf, timestamp }: {
  rows: ARRow[];
  totals: ARTotals;
  asOf: string;
  timestamp: string;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isPdfPending, startPdf] = useTransition();
  const [isEmailPending, startEmail] = useTransition();
  const downloadRef = useRef<HTMLDivElement>(null);

  // Column visibility (bucket cols only; Client + Total always shown)
  const [visibleCols, setVisibleCols] = useState<Record<BucketKey, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { current: true, d1_30: true, d31_60: true, d61_90: true, d91plus: true };
  });

  const activeCols = ALL_COLS.filter(c => visibleCols[c.key]);

  function toggleCol(key: BucketKey) {
    const next = { ...visibleCols, [key]: !visibleCols[key] };
    const anyVisible = Object.values(next).some(Boolean);
    if (!anyVisible) return;
    setVisibleCols(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  // Close download dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setShowDownload(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Build PDF payload ─────────────────────────────────────────────────────
  function buildPayload() {
    const pdfRows = rows.map(r => ({
      name: r.name,
      ...(visibleCols.current  ? { current:  r.current  || null } : {}),
      ...(visibleCols.d1_30   ? { d1_30:    r.d1_30    || null } : {}),
      ...(visibleCols.d31_60  ? { d31_60:   r.d31_60   || null } : {}),
      ...(visibleCols.d61_90  ? { d61_90:   r.d61_90   || null } : {}),
      ...(visibleCols.d91plus ? { d91plus:  r.d91plus  || null } : {}),
      total: r.total,
    }));
    return {
      title: "A/R Aging Summary",
      subtitle: "BZA International Services",
      dateLabel: `As of ${asOf}`,
      columns: [
        { key: "name",    label: "Client",       align: "left"  as const },
        ...activeCols.map(c => ({ key: c.key, label: c.label, align: "right" as const, format: "currency" as const })),
        { key: "total",   label: "Total",         align: "right" as const, format: "currency" as const },
      ],
      rows: pdfRows,
      totals: {
        ...(visibleCols.current  ? { current:  totals.current  || undefined } : {}),
        ...(visibleCols.d1_30   ? { d1_30:    totals.d1_30    || undefined } : {}),
        ...(visibleCols.d31_60  ? { d31_60:   totals.d31_60   || undefined } : {}),
        ...(visibleCols.d61_90  ? { d61_90:   totals.d61_90   || undefined } : {}),
        ...(visibleCols.d91plus ? { d91plus:  totals.d91plus  || undefined } : {}),
        total: totals.total,
      },
      totalsLabel: `TOTAL (${rows.length} clients)`,
    };
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  function handlePdf() {
    setShowDownload(false);
    startPdf(async () => {
      const res = await fetch("/api/reports/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) { setToast({ message: "PDF generation failed", type: "error" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "AR-Aging-Summary.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  function handleExcel() {
    setShowDownload(false);
    const headers = ["Client", ...activeCols.map(c => c.label), "Total"];
    const dataRows = rows.map(r => [
      r.name,
      ...activeCols.map(c => r[c.key] || 0),
      r.total,
    ]);
    const totalsRow = ["TOTAL", ...activeCols.map(c => totals[c.key] || 0), totals.total];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalsRow]);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.max(h.length, i === 0 ? 30 : 12) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AR Aging Summary");
    XLSX.writeFile(wb, "AR-Aging-Summary.xlsx");
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  function handleCsv() {
    setShowDownload(false);
    const headers = ["Client", ...activeCols.map(c => c.label), "Total"];
    const dataRows = rows.map(r => [r.name, ...activeCols.map(c => r[c.key] || 0), r.total]);
    const totalsRow = ["TOTAL", ...activeCols.map(c => totals[c.key] || 0), totals.total];
    const csv = [headers, ...dataRows, totalsRow].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AR-Aging-Summary.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  function handleSendEmail(to: string, subject: string, message: string) {
    startEmail(async () => {
      const res = await fetch("/api/reports/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), to, subject, message }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setToast({ message: json.error ?? "Send failed", type: "error" }); }
      else { setToast({ message: `Sent to ${to}`, type: "success" }); setShowEmail(false); }
    });
  }

  return (
    <>
      {showEmail && <EmailModal onClose={() => setShowEmail(false)} onSend={handleSendEmail} isSending={isEmailPending} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-stone-800 text-white" : "bg-red-700 text-white"}`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Floating Customize tab */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] print:hidden">
        <button
          onClick={() => setShowCustomize(v => !v)}
          className="bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-xs font-semibold px-3 py-2.5 rounded-l-lg shadow-lg flex flex-col items-center gap-1.5"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <Settings2 className="w-3.5 h-3.5" style={{ transform: "rotate(180deg)" }} />
          Customize
        </button>
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div className="fixed right-10 top-1/2 -translate-y-1/2 z-[59] bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-52 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Columns</span>
            <button onClick={() => setShowCustomize(false)} className="text-stone-400 hover:text-stone-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2">
            {ALL_COLS.map(c => (
              <label key={c.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={visibleCols[c.key]}
                  onChange={() => toggleCol(c.key)}
                  className="rounded border-stone-300 text-[#0d3d3b] focus:ring-[#0d3d3b]" />
                <span className="text-sm text-stone-600">{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 max-w-5xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
            <ArrowLeft className="w-4 h-4" /> Back to reports
          </Link>
          <div className="flex items-center gap-2">
            {/* Download dropdown */}
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setShowDownload(v => !v)}
                disabled={isPdfPending}
                className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isPdfPending ? "Generating…" : "Download"}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showDownload && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 min-w-[140px] py-1">
                  <button onClick={handlePdf} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">PDF</button>
                  <button onClick={handleExcel} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Excel (.xlsx)</button>
                  <button onClick={handleCsv} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">CSV</button>
                </div>
              )}
            </div>
            <button onClick={() => setShowEmail(true)}
              className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors">
              <Mail className="w-4 h-4" /> Send
            </button>
          </div>
        </div>

        {/* Report card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none">
          <div className="py-6 text-center border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-800">A/R Aging Summary</h2>
            <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
            <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide w-48">Client</th>
                  {activeCols.map(c => (
                    <th key={c.key} className="text-right px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">{c.label}</th>
                  ))}
                  <th className="text-right px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.name} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-6 py-3 text-stone-700 font-medium">
                      <Link href={`/reports/ar-aging-detail?client=${encodeURIComponent(row.name)}`}
                        className="hover:text-[#0d3d3b] hover:underline">{row.name}</Link>
                    </td>
                    {activeCols.map(c => (
                      <td key={c.key} className={`px-4 py-3 text-right ${row[c.key] === 0 ? "text-stone-300" : "text-stone-700"}`}>
                        {row[c.key] === 0 ? "" : (
                          <Link href={`/reports/ar-aging-detail?client=${encodeURIComponent(row.name)}&bucket=${BUCKET_MAP[c.key]}`}
                            className="hover:underline hover:opacity-70">
                            {formatCurrency(row[c.key])}
                          </Link>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-right font-semibold text-stone-800">
                      <Link href={`/reports/ar-aging-detail?client=${encodeURIComponent(row.name)}`}
                        className="hover:underline hover:opacity-70">{formatCurrency(row.total)}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 bg-stone-50">
                  <td className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">TOTAL</td>
                  {activeCols.map(c => (
                    <td key={c.key} className={`px-4 py-3 text-right font-bold ${totals[c.key] === 0 ? "text-stone-300" : "text-stone-800"}`}>
                      {totals[c.key] === 0 ? "" : formatCurrency(totals[c.key])}
                    </td>
                  ))}
                  <td className="px-6 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">{timestamp}</div>
        </div>
      </div>
    </>
  );
}
