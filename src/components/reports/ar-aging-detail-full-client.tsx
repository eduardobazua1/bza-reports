"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Mail, X, Check, Settings2, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import * as XLSX from "xlsx";

type Row = { date: string | null; num: string; customer: string; dueDate: string | null; amount: number; pastDue: number };
type Bucket = { key: string; label: string; order: number; rows: Row[] };

type VisibleCols = {
  date: boolean; type: boolean; invoice: boolean; dueDate: boolean;
  amount: boolean; openBalance: boolean; pastDue: boolean;
};
type ViewMode = "grouped" | "flat";
type ToastState = { message: string; type: "success" | "error" } | null;

const STORAGE_KEY = "bza_cols_ar-aging-detail";

const COL_DEFS: { key: keyof VisibleCols; label: string; alwaysOn?: boolean }[] = [
  { key: "date",        label: "Date" },
  { key: "type",        label: "Type" },
  { key: "invoice",     label: "Invoice" },
  { key: "dueDate",     label: "Due Date" },
  { key: "amount",      label: "Amount" },
  { key: "openBalance", label: "Open Balance" },
  { key: "pastDue",     label: "Past Due" },
];

function fmtDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function daysDisplay(row: { dueDate: string | null; pastDue: number }): { text: string; cls: string } {
  if (!row.dueDate) return { text: "—", cls: "text-stone-400" };
  if (row.pastDue > 0)   return { text: `+${row.pastDue}`, cls: "text-[#0d9488]" };
  if (row.pastDue === 0) return { text: "0", cls: "text-amber-500 font-bold" };
  return { text: `${row.pastDue}`, cls: "text-stone-400" };
}

function EmailModal({ onClose, onSend, isSending }: { onClose: () => void; onSend: (to: string, subject: string, message: string) => void; isSending: boolean }) {
  const [to, setTo] = useState(""); const [subject, setSubject] = useState("A/R Aging Detail — BZA International Services"); const [message, setMessage] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Send Report by Email</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSend(to.trim(), subject, message); }} className="p-5 space-y-4">
          <div><label className="block text-xs font-medium text-stone-600 mb-1">To <span className="text-red-500">*</span></label>
            <input type="email" value={to} onChange={e => setTo(e.target.value)} required placeholder="recipient@example.com" className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400" /></div>
          <div><label className="block text-xs font-medium text-stone-600 mb-1">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400" /></div>
          <div><label className="block text-xs font-medium text-stone-600 mb-1">Message <span className="text-stone-400">(optional)</span></label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={isSending || !to.trim()} className="px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50">{isSending ? "Sending…" : "Send"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ARAgingDetailFullClient({ buckets, total, filterBucket, filterClient, asOf, timestamp }: {
  buckets: Bucket[]; total: number; filterBucket?: string; filterClient?: string; asOf: string; timestamp: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [visibleCols, setVisibleCols] = useState<VisibleCols>(() => {
    if (typeof window !== "undefined") {
      try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
    }
    return { date: true, type: true, invoice: true, dueDate: true, amount: true, openBalance: true, pastDue: true };
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCustomize, setShowCustomize] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isPdfPending, startPdf] = useTransition();
  const [isEmailPending, startEmail] = useTransition();
  const downloadRef = useRef<HTMLDivElement>(null);
  const [sortCol, setSortCol] = useState<"date" | "invoice" | "customer" | "dueDate" | "amount" | "pastDue" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(col: "date" | "invoice" | "customer" | "dueDate" | "amount" | "pastDue") {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function sortRows(rows: Row[]) {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortCol) {
        case "date":     av = a.date ?? "";     bv = b.date ?? "";     break;
        case "invoice":  av = a.num;            bv = b.num;            break;
        case "customer": av = a.customer;       bv = b.customer;       break;
        case "dueDate":  av = a.dueDate ?? "";  bv = b.dueDate ?? "";  break;
        case "amount":   av = a.amount;         bv = b.amount;         break;
        case "pastDue":  av = a.pastDue;        bv = b.pastDue;        break;
        default: return 0;
      }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });
  }

  useEffect(() => {
    function handle(e: MouseEvent) { if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) setShowDownload(false); }
    document.addEventListener("mousedown", handle); return () => document.removeEventListener("mousedown", handle);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  function toggleCol(key: keyof VisibleCols) {
    const next = { ...visibleCols, [key]: !visibleCols[key] };
    if (!Object.values(next).some(Boolean)) return;
    setVisibleCols(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  // Gather all visible rows (respecting filters)
  const active = buckets.filter(b => b.rows.length > 0 && (!filterBucket || b.key === filterBucket));
  const allRows: Row[] = active.flatMap(b => filterClient ? b.rows.filter(r => r.customer.toLowerCase().includes(filterClient.toLowerCase())) : b.rows);

  // Build visible headers for export
  function buildExportHeaders() {
    const h: string[] = [];
    if (visibleCols.date) h.push("Date");
    if (visibleCols.type) h.push("Type");
    if (visibleCols.invoice) h.push("Invoice");
    h.push("Customer");
    if (visibleCols.dueDate) h.push("Due Date");
    if (visibleCols.amount) h.push("Amount");
    if (visibleCols.openBalance) h.push("Open Balance");
    if (visibleCols.pastDue) h.push("Past Due");
    return h;
  }

  function buildExportRows() {
    return allRows.map(r => {
      const obj: Record<string, string | number> = {};
      if (visibleCols.date) obj["Date"] = fmtDate(r.date);
      if (visibleCols.type) obj["Type"] = "Invoice";
      if (visibleCols.invoice) obj["Invoice"] = r.num;
      obj["Customer"] = r.customer;
      if (visibleCols.dueDate) obj["Due Date"] = fmtDate(r.dueDate);
      if (visibleCols.amount) obj["Amount"] = r.amount;
      if (visibleCols.openBalance) obj["Open Balance"] = r.amount;
      if (visibleCols.pastDue) obj["Past Due"] =!r.dueDate ? "" : r.pastDue === 0 ? "0" : r.pastDue > 0 ? `+${r.pastDue}` : `${r.pastDue}`;
      return obj;
    });
  }

  function buildPdfPayload() {
    const headers = buildExportHeaders();
    const exportRows = buildExportRows();
    const amtIdx = headers.indexOf("Amount");
    const obalIdx = headers.indexOf("Open Balance");
    const totalsObj: Record<string, number> = {};
    if (amtIdx >= 0) totalsObj[String(amtIdx)] = total;
    if (obalIdx >= 0) totalsObj[String(obalIdx)] = total;
    return {
      title: "A/R Aging Detail", subtitle: "BZA International Services", dateLabel: `As of ${asOf}`,
      columns: headers.map((h, i) => ({ key: String(i), label: h, align: (["Date", "Type", "Invoice", "Customer", "Due Date"].includes(h) ? "left" : "right") as "left" | "right", ...(["Amount", "Open Balance"].includes(h) ? { format: "currency" as const } : {}) })),
      rows: exportRows.map(r => Object.fromEntries(headers.map((h, i) => [String(i), r[h] ?? ""]))),
      totals: totalsObj,
      totalsLabel: `TOTAL (${allRows.length} invoices)`,
    };
  }

  function handlePdf() {
    setShowDownload(false);
    startPdf(async () => {
      const res = await fetch("/api/reports/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPdfPayload()) });
      if (!res.ok) { setToast({ message: "PDF generation failed", type: "error" }); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "AR-Aging-Detail.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  function handleExcel() {
    setShowDownload(false);
    const headers = buildExportHeaders(); const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => headers.map(h => r[h]))]);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.max(h.length, i === 2 ? 20 : 14) + 2 }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "AR Aging Detail");
    XLSX.writeFile(wb, "AR-Aging-Detail.xlsx");
  }

  function handleCsv() {
    setShowDownload(false);
    const headers = buildExportHeaders(); const rows = buildExportRows();
    const csv = [headers, ...rows.map(r => headers.map(h => r[h]))].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AR-Aging-Detail.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function handleSendEmail(to: string, subject: string, message: string) {
    startEmail(async () => {
      const res = await fetch("/api/reports/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...buildPdfPayload(), to, subject, message }) });
      const json = await res.json();
      if (!res.ok || json.error) setToast({ message: json.error ?? "Send failed", type: "error" });
      else { setToast({ message: `Sent to ${to}`, type: "success" }); setShowEmail(false); }
    });
  }

  // Count visible columns (for colSpan)
  const colCount = [visibleCols.date, visibleCols.type, visibleCols.invoice, true /*customer*/, visibleCols.dueDate, visibleCols.amount, visibleCols.openBalance, visibleCols.pastDue].filter(Boolean).length;

  const SI = ({ col }: { col: "date" | "invoice" | "customer" | "dueDate" | "amount" | "pastDue" }) =>
    sortCol === col ? <span className="ml-1 text-[#0d9488]">{sortDir === "asc" ? "↑" : "↓"}</span> : <span className="ml-0.5 text-stone-300">↕</span>;

  return (
    <>
      {showEmail && <EmailModal onClose={() => setShowEmail(false)} onSend={handleSendEmail} isSending={isEmailPending} />}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-stone-800 text-white" : "bg-red-700 text-white"}`}>
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Floating Customize tab */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] print:hidden">
        <button onClick={() => setShowCustomize(v => !v)}
          className="bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-xs font-semibold px-3 py-2.5 rounded-l-lg shadow-lg flex flex-col items-center gap-1.5"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          <Settings2 className="w-3.5 h-3.5" style={{ transform: "rotate(180deg)" }} />
          Customize
        </button>
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div className="fixed right-10 top-1/2 -translate-y-1/2 z-[59] bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-56 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Columns</span>
            <button onClick={() => setShowCustomize(false)} className="text-stone-400 hover:text-stone-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2 mb-4">
            {COL_DEFS.map(c => (
              <label key={c.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={visibleCols[c.key]} onChange={() => toggleCol(c.key)} className="rounded border-stone-300 text-[#0d9488] focus:ring-[#0d9488]" />
                <span className="text-sm text-stone-600">{c.label}</span>
              </label>
            ))}
            <p className="text-[10px] text-stone-400 pt-1">Customer always visible</p>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">View</p>
            {(["grouped", "flat"] as const).map(m => (
              <label key={m} className="flex items-center gap-2 cursor-pointer mb-1.5">
                <input type="radio" name="viewMode" value={m} checked={viewMode === m} onChange={() => setViewMode(m)} className="text-[#0d9488] focus:ring-[#0d9488]" />
                <span className="text-sm text-stone-600">{m === "grouped" ? "Group by aging period" : "Flat — all rows"}</span>
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
          <div className="flex items-center gap-3">
            <Link href="/reports/ar-aging-summary" className="text-sm text-[#0d9488] hover:underline">← Back to summary</Link>
            <div className="relative" ref={downloadRef}>
              <button onClick={() => setShowDownload(v => !v)} disabled={isPdfPending}
                className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />{isPdfPending ? "Generating…" : "Download"}<ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showDownload && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 min-w-[140px] py-1">
                  <button onClick={handlePdf} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">PDF</button>
                  <button onClick={handleExcel} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Excel (.xlsx)</button>
                  <button onClick={handleCsv} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">CSV</button>
                </div>
              )}
            </div>
            <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors">
              <Mail className="w-4 h-4" /> Send
            </button>
          </div>
        </div>

        {/* Filter badge */}
        {(filterClient || filterBucket) && (
          <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-2">
            <span>Filtered by:</span>
            {filterClient && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{filterClient}</span>}
            {filterBucket && <span className="bg-[#0d3d3b]/10 text-[#0d3d3b] px-2 py-0.5 rounded font-medium">{buckets.find(b => b.key === filterBucket)?.label}</span>}
            <Link href="/reports/ar-aging-detail" className="ml-auto text-xs text-stone-400 hover:text-stone-600">Clear filter</Link>
          </div>
        )}

        {/* Report card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="py-6 text-center border-b border-stone-100">
            <h2 className="text-lg font-bold text-stone-800">A/R Aging Detail Report</h2>
            <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
            <p className="text-sm text-stone-400 mt-0.5">As of {asOf}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide select-none">
                  {visibleCols.date        && <th onClick={() => handleSort("date")} className="text-left px-6 py-3 w-32 cursor-pointer hover:text-stone-700">Date<SI col="date" /></th>}
                  {visibleCols.type        && <th className="text-left px-4 py-3 w-24">Type</th>}
                  {visibleCols.invoice     && <th onClick={() => handleSort("invoice")} className="text-left px-4 py-3 w-32 cursor-pointer hover:text-stone-700">Invoice<SI col="invoice" /></th>}
                  <th onClick={() => handleSort("customer")} className="text-left px-4 py-3 cursor-pointer hover:text-stone-700">Customer<SI col="customer" /></th>
                  {visibleCols.dueDate     && <th onClick={() => handleSort("dueDate")} className="text-left px-4 py-3 w-28 cursor-pointer hover:text-stone-700">Due Date<SI col="dueDate" /></th>}
                  {visibleCols.amount      && <th onClick={() => handleSort("amount")} className="text-right px-4 py-3 w-32 cursor-pointer hover:text-stone-700">Amount<SI col="amount" /></th>}
                  {visibleCols.openBalance && <th onClick={() => handleSort("amount")} className="text-right px-4 py-3 w-32 cursor-pointer hover:text-stone-700">Open Balance<SI col="amount" /></th>}
                  {visibleCols.pastDue     && <th onClick={() => handleSort("pastDue")} className="text-right px-6 py-3 w-28 cursor-pointer hover:text-stone-700">Past Due<SI col="pastDue" /></th>}
                </tr>
              </thead>
              <tbody>
                {viewMode === "flat" ? (
                  /* ── Flat view ─────────────────────────────────────────── */
                  <>
                    {(sortCol ? sortRows(allRows) : [...allRows].sort((a, b) => b.pastDue - a.pastDue)).map((row, i) => (
                      <tr key={i} className="border-t border-stone-50 hover:bg-stone-50">
                        {visibleCols.date        && <td className="px-6 py-2.5 text-stone-600">{fmtDate(row.date)}</td>}
                        {visibleCols.type        && <td className="px-4 py-2.5 text-stone-500">Invoice</td>}
                        {visibleCols.invoice     && <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{row.num}</td>}
                        <td className="px-4 py-2.5 text-stone-700">{row.customer}</td>
                        {visibleCols.dueDate     && <td className="px-4 py-2.5 text-stone-600">{fmtDate(row.dueDate)}</td>}
                        {visibleCols.amount      && <td className="px-4 py-2.5 text-right text-stone-700">{formatCurrency(row.amount)}</td>}
                        {visibleCols.openBalance && <td className="px-4 py-2.5 text-right font-medium text-stone-800">{formatCurrency(row.amount)}</td>}
                        {visibleCols.pastDue     && (() => { const d = daysDisplay(row); return <td className={`px-6 py-2.5 text-right font-medium ${d.cls}`}>{d.text}</td>; })()}
                      </tr>
                    ))}
                    {allRows.length === 0 && (
                      <tr><td colSpan={colCount} className="px-6 py-8 text-center text-stone-400">No invoices found</td></tr>
                    )}
                  </>
                ) : (
                  /* ── Grouped view ──────────────────────────────────────── */
                  active.map(bucket => {
                    const bucketRows = sortRows(filterClient ? bucket.rows.filter(r => r.customer.toLowerCase().includes(filterClient.toLowerCase())) : bucket.rows);
                    if (bucketRows.length === 0) return null;
                    const bucketTotal = bucketRows.reduce((s, r) => s + r.amount, 0);
                    const isOpen = !collapsed[bucket.key];
                    return [
                      <tr key={`hdr-${bucket.key}`} className="border-t border-stone-100 bg-stone-50 cursor-pointer select-none hover:bg-stone-100"
                        onClick={() => setCollapsed(p => ({ ...p, [bucket.key]: !p[bucket.key] }))}>
                        <td colSpan={colCount} className="px-6 py-2.5">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                            <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">{bucket.label} ({bucketRows.length})</span>
                          </div>
                        </td>
                      </tr>,
                      ...(isOpen ? bucketRows.map((row, i) => (
                        <tr key={`${bucket.key}-${i}`} className="border-t border-stone-50 hover:bg-stone-50">
                          {visibleCols.date        && <td className="px-6 py-2.5 text-stone-600">{fmtDate(row.date)}</td>}
                          {visibleCols.type        && <td className="px-4 py-2.5 text-stone-500">Invoice</td>}
                          {visibleCols.invoice     && <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{row.num}</td>}
                          <td className="px-4 py-2.5 text-stone-700">{row.customer}</td>
                          {visibleCols.dueDate     && <td className="px-4 py-2.5 text-stone-600">{fmtDate(row.dueDate)}</td>}
                          {visibleCols.amount      && <td className="px-4 py-2.5 text-right text-stone-700">{formatCurrency(row.amount)}</td>}
                          {visibleCols.openBalance && <td className="px-4 py-2.5 text-right font-medium text-stone-800">{formatCurrency(row.amount)}</td>}
                          {visibleCols.pastDue     && (
                            <td className={`px-6 py-2.5 text-right font-medium ${row.pastDue > 90 ? "text-red-600" : row.pastDue > 60 ? "text-amber-600" : row.pastDue > 0 ? "text-stone-600" : "text-stone-400"}`}>
                              {row.pastDue <= 0 ? "—" : row.pastDue}
                            </td>
                          )}
                        </tr>
                      )) : []),
                      ...(isOpen ? [
                        <tr key={`sub-${bucket.key}`} className="border-t border-stone-200 bg-stone-50">
                          <td colSpan={colCount - (visibleCols.amount ? 2 : 0) - (visibleCols.openBalance ? 1 : 0) - (visibleCols.pastDue ? 1 : 0)}
                            className="px-6 py-2 text-xs font-semibold text-stone-500">Total for {bucket.label}</td>
                          {visibleCols.amount      && <td className="px-4 py-2 text-right font-bold text-stone-800">{formatCurrency(bucketTotal)}</td>}
                          {visibleCols.openBalance && <td className="px-4 py-2 text-right font-bold text-stone-800">{formatCurrency(bucketTotal)}</td>}
                          {visibleCols.pastDue     && <td className="px-6 py-2" />}
                        </tr>
                      ] : []),
                    ];
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-400">
                  <td colSpan={colCount - (visibleCols.amount ? 2 : 0) - (visibleCols.openBalance ? 1 : 0) - (visibleCols.pastDue ? 1 : 0)}
                    className="px-6 py-3 text-sm font-bold text-stone-900 uppercase tracking-wide">TOTAL</td>
                  {visibleCols.amount      && <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(total)}</td>}
                  {visibleCols.openBalance && <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(total)}</td>}
                  {visibleCols.pastDue     && <td className="px-6 py-3" />}
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
