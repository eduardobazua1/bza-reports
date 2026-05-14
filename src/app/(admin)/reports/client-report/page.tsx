"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, CheckCircle2, AlertCircle, FileSpreadsheet,
  FileText, Loader2, Eye, Package, Download,
} from "lucide-react";

const ALL_COLS: { key: string; label: string; default: boolean }[] = [
  { key: "currentLocation",   label: "Current Location",  default: true  },
  { key: "poNumber",          label: "Purchase Order",     default: true  },
  { key: "clientPoNumber",    label: "Client PO",          default: true  },
  { key: "invoiceNumber",     label: "Invoice",            default: true  },
  { key: "vehicleId",         label: "Vehicle ID",         default: true  },
  { key: "blNumber",          label: "BL Number",          default: true  },
  { key: "quantityTons",      label: "Qty (TN)",           default: true  },
  { key: "sellPrice",         label: "Price",              default: true  },
  { key: "shipmentStatus",    label: "Status",             default: true  },
  { key: "shipmentDate",      label: "Ship Date",          default: true  },
  { key: "lastLocationUpdate",label: "Last Update",        default: false },
  { key: "estimatedArrival",  label: "ETA",                default: false },
  { key: "item",              label: "Item",               default: false },
  { key: "billingDocument",   label: "Billing Doc.",       default: false },
  { key: "terms",             label: "Terms",              default: false },
  { key: "transportType",     label: "Transport",          default: false },
  { key: "licenseFsc",        label: "License #",          default: false },
  { key: "chainOfCustody",    label: "Chain of Custody",   default: false },
  { key: "inputClaim",        label: "Input Claim",        default: false },
  { key: "outputClaim",       label: "Output Claim",       default: false },
];

const DEFAULT_COLS = ALL_COLS.filter(c => c.default).map(c => c.key);

type PreviewRow = Record<string, string | number | null>;

const STATUS_COLORS: Record<string, string> = {
  "delivered":  "bg-emerald-100 text-emerald-700",
  "in transit": "bg-blue-100 text-blue-700",
  "customs":    "bg-amber-100 text-amber-700",
  "scheduled":  "bg-stone-100 text-stone-500",
};

function statusBadge(s: string) {
  const cls = STATUS_COLORS[s.toLowerCase()] ?? "bg-stone-100 text-stone-500";
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

export default function ClientReportPage() {
  const [clients, setClients] = useState<{ id: number; name: string; contactEmail?: string | null }[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [format, setFormat] = useState<"excel" | "pdf" | "both">("excel");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedCols, setSelectedCols] = useState<string[]>(DEFAULT_COLS);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [downloading, setDownloading] = useState<"excel" | "pdf" | null>(null);
  const [dlOpen, setDlOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setClients(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) { setEmail(""); setPreview([]); return; }
    const c = clients.find(c => c.id === clientId);
    setEmail(c?.contactEmail ?? "");
  }, [clientId, clients]);

  const fetchPreview = useCallback(async () => {
    if (!clientId) { setPreview([]); return; }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/report-preview?clientId=${clientId}&filter=${activeOnly ? "active" : "all"}`);
      const data = await res.json();
      if (Array.isArray(data)) setPreview(data);
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  }, [clientId, activeOnly]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  async function send() {
    if (!clientId || !email) return;
    setStatus("sending");
    const client = clients.find(c => c.id === clientId);
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, email,
          subject: `BZA. Shipment Report — ${client?.name}`,
          message: `Please find attached the latest shipment report for ${client?.name}.`,
          columns: selectedCols,
          format,
          filter: activeOnly ? "active" : "all",
        }),
      });
      if (res.ok) {
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        setErrMsg(d.error ?? "Failed to send");
        setStatus("err");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setErrMsg("Network error");
      setStatus("err");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  async function download(fmt: "excel" | "pdf") {
    if (!clientId) return;
    setDownloading(fmt);
    try {
      const params = new URLSearchParams({
        clientId: String(clientId),
        format: fmt,
        filter: activeOnly ? "active" : "all",
        columns: selectedCols.join(","),
      });
      const res = await fetch(`/api/download-report?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.href     = url;
      a.download = match?.[1] ?? `BZA_Report.${fmt === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setDownloading(null); }
  }

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-900">Client Report</h1>

      <div className="flex gap-4 items-start">

        {/* ── Main card ── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm overflow-hidden">

          {/* Top bar: client + email */}
          <div className="px-5 pt-5 pb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value ? Number(e.target.value) : "")}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20 text-stone-700"
              >
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Recipient email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@client.com"
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20 text-stone-700"
              />
            </div>
          </div>

          {/* Options row */}
          <div className="px-5 pb-4 flex items-center gap-2">
            {/* Format */}
            <div className="flex rounded-lg border border-stone-200 overflow-hidden">
              {(["excel", "pdf", "both"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-r border-stone-200 last:border-r-0 transition-colors ${
                    format === f ? "bg-[#0d3d3b] text-white" : "bg-white text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  {f === "excel" && <FileSpreadsheet className="w-3 h-3" />}
                  {f === "pdf"   && <FileText className="w-3 h-3" />}
                  {f === "both"  && <><FileSpreadsheet className="w-3 h-3" /><FileText className="w-3 h-3" /></>}
                  {f === "excel" ? "Excel" : f === "pdf" ? "PDF" : "Both"}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-stone-200 mx-1" />

            {/* Active only toggle */}
            <button onClick={() => setActiveOnly(v => !v)} className="flex items-center gap-2 group">
              <span className={`relative inline-flex w-8 h-4 shrink-0 rounded-full transition-colors ${activeOnly ? "bg-[#0d3d3b]" : "bg-stone-200"}`}>
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${activeOnly ? "translate-x-4" : "translate-x-0.5"}`} />
              </span>
              <span className="text-xs text-stone-500 whitespace-nowrap group-hover:text-stone-700 transition-colors">Active only</span>
            </button>

            {/* Download dropdown — right side */}
            <div className="ml-auto relative">
              <button
                onClick={() => setDlOpen(o => !o)}
                disabled={!clientId || preview.length === 0 || downloading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download
              </button>
              {dlOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-stone-100 overflow-hidden z-20">
                  <button
                    onClick={() => { setDlOpen(false); download("excel"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-stone-400" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => { setDlOpen(false); download("pdf"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition-colors border-t border-stone-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Empty state ── */}
          {!clientId && (
            <div className="border-t border-stone-100 px-5 py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-stone-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-400">Select a client to get started</p>
                <p className="text-xs text-stone-300 mt-0.5">The preview and actions will appear here</p>
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {clientId && (
            <div className="border-t border-stone-100">
              <div className="px-5 py-2.5 flex items-center justify-between bg-stone-50/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                  {!previewLoading && preview.length > 0 && (
                    <span className="bg-white border border-stone-200 text-stone-500 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                      {preview.length} rows
                    </span>
                  )}
                  {selectedClient && (
                    <span className="text-stone-400 font-normal">· {selectedClient.name}</span>
                  )}
                </div>
                {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
              </div>

              {!previewLoading && preview.length === 0 && (
                <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
                  <Package className="w-7 h-7 text-stone-200" />
                  <p className="text-xs text-stone-400">No shipments found with the current filter.</p>
                </div>
              )}

              {!previewLoading && preview.length > 0 && selectedCols.length === 0 && (
                <p className="px-5 py-4 text-xs text-stone-400 text-center">Select at least one column in Customize →</p>
              )}

              {!previewLoading && preview.length > 0 && selectedCols.length > 0 && (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-50 border-b border-stone-100">
                      <tr>
                        {selectedCols.map(key => (
                          <th key={key} className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">
                            {ALL_COLS.find(c => c.key === key)?.label ?? key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                          {selectedCols.map(key => {
                            const val = row[key];
                            const display = val === null || val === undefined ? "—" : String(val);
                            return (
                              <td key={key} className="px-3 py-2 text-stone-600 whitespace-nowrap max-w-[160px] truncate">
                                {key === "shipmentStatus" && val ? statusBadge(display) : display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          {clientId && (
            <div className="px-5 py-3.5 border-t border-stone-100 flex items-center gap-3">
              <button
                onClick={send}
                disabled={!email || status === "sending" || preview.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0d3d3b] text-white hover:bg-[#0a5c5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {status === "sending" ? "Sending…" : "Send report"}
              </button>

              {status === "ok" && (
                <span className="flex items-center gap-1.5 text-xs text-[#0d3d3b] font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Sent successfully
                </span>
              )}
              {status === "err" && (
                <span className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle className="w-4 h-4" /> {errMsg}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Customize panel ── */}
        <div className="w-48 shrink-0 bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Teal header */}
          <div className="bg-[#0d3d3b] px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Customize</span>
            <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
              {selectedCols.length}/{ALL_COLS.length}
            </span>
          </div>

          {/* Shortcuts */}
          <div className="px-4 py-2 flex items-center gap-1.5 border-b border-stone-100">
            {["All", "Default", "None"].map((label) => (
              <button
                key={label}
                onClick={() => {
                  if (label === "All") setSelectedCols(ALL_COLS.map(c => c.key));
                  else if (label === "Default") setSelectedCols(DEFAULT_COLS);
                  else setSelectedCols([]);
                }}
                className="flex-1 text-[10px] font-medium text-stone-400 hover:text-[#0d3d3b] hover:bg-stone-50 rounded py-0.5 transition-colors text-center"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Column list */}
          <div className="py-2">
            {ALL_COLS.map((col, i) => {
              const isChecked = selectedCols.includes(col.key);
              const showDivider = i === DEFAULT_COLS.length && i > 0;
              return (
                <div key={col.key}>
                  {showDivider && <div className="mx-4 my-1.5 border-t border-dashed border-stone-200" />}
                  <label className={`flex items-center gap-2.5 px-4 py-1.5 cursor-pointer transition-colors ${isChecked ? "bg-[#0d3d3b]/5" : "hover:bg-stone-50"}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => setSelectedCols(prev =>
                        e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key)
                      )}
                      className="w-3.5 h-3.5 accent-[#0d3d3b] cursor-pointer shrink-0"
                    />
                    <span className={`text-xs leading-tight transition-colors ${isChecked ? "text-[#0d3d3b] font-medium" : "text-stone-400"}`}>
                      {col.label}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
