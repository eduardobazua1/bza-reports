"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Mail, X, Check, Settings2, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type FlatRow = Record<string, string | number>;

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  filename: string;
  emailSubject: string;
  headers: string[];
  rows: FlatRow[];
  children: React.ReactNode;
};

type ToastState = { message: string; type: "success" | "error" } | null;

// ─── Email modal ──────────────────────────────────────────────────────────────
function EmailModal({ onClose, onSend, isSending, defaultSubject }: {
  onClose: () => void;
  onSend: (to: string, subject: string, message: string) => void;
  isSending: boolean;
  defaultSubject: string;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
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

// ─── AgingDetailToolbar ───────────────────────────────────────────────────────
export function AgingDetailToolbar({
  title,
  backHref,
  backLabel,
  filename,
  emailSubject,
  headers,
  rows,
  children,
}: Props) {
  const [showEmail, setShowEmail] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isPdfPending, startPdf] = useTransition();
  const [isEmailPending, startEmail] = useTransition();
  const downloadRef = useRef<HTMLDivElement>(null);

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
    const columns = headers.map((h, i) => ({
      key: String(i),
      label: h,
      align: (i === 0 ? "left" : "right") as "left" | "right",
    }));
    const pdfRows = rows.map(r =>
      Object.fromEntries(headers.map((h, i) => [String(i), r[h] ?? ""]))
    );
    return {
      title,
      subtitle: "BZA International Services",
      dateLabel: `As of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      columns,
      rows: pdfRows,
      totals: {},
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
      const a = document.createElement("a"); a.href = url; a.download = `${filename}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  function handleExcel() {
    setShowDownload(false);
    const dataRows = rows.map(r => headers.map(h => r[h] ?? ""));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.max(h.length, i === 0 ? 20 : 12) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, filename);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  function handleCsv() {
    setShowDownload(false);
    const dataRows = rows.map(r => headers.map(h => r[h] ?? ""));
    const csv = [headers, ...dataRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`;
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
      {showEmail && (
        <EmailModal
          onClose={() => setShowEmail(false)}
          onSend={handleSendEmail}
          isSending={isEmailPending}
          defaultSubject={emailSubject}
        />
      )}

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
          <p className="text-xs text-stone-500">Column options are not available for detail reports.</p>
        </div>
      )}

      {/* Toolbar row */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
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
          <Link href={backHref} className="text-sm text-[#0d9488] hover:underline">
            {backLabel}
          </Link>
        </div>
      </div>

      {/* Page content */}
      {children}
    </>
  );
}
