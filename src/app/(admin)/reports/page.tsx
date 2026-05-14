"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Star, ChevronDown, Send, Mail, CheckCircle2,
  AlertCircle, FileSpreadsheet, FileText, Loader2,
  ChevronRight, Eye, Package, Download,
} from "lucide-react";

// ── Report catalogue ──────────────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  {
    id: "business-overview",
    label: "Business Overview",
    reports: [
      { id: "balance-sheet",   label: "Balance Sheet",     href: "/reports/balance-sheet",   ready: false },
      { id: "pl-by-customer",  label: "P&L by Customer",   href: "/reports/pl-by-customer",  ready: true  },
      { id: "pl-by-month",     label: "P&L by Month",      href: "/reports/pl-by-month",     ready: true  },
    ],
  },
  {
    id: "who-owes-you",
    label: "Who Owes You",
    reports: [
      { id: "ar-aging-summary",  label: "A/R Aging Summary",  href: "/reports/ar-aging-summary",  ready: true  },
      { id: "ar-aging-detail",   label: "A/R Aging Detail",   href: "/reports/ar-aging-detail",   ready: true  },
      { id: "open-invoices",     label: "Open Invoices",      href: "/reports/open-invoices",     ready: true  },
      { id: "invoice-list",      label: "Invoice List",       href: "/reports/invoice-list",      ready: true  },
      { id: "received-payments", label: "Received Payments",  href: "/reports/received-payments", ready: true  },
      { id: "statements",        label: "Statements",         href: "/reports/statements",        ready: true  },
    ],
  },
  {
    id: "sales-customers",
    label: "Sales & Customers",
    reports: [
      { id: "customer-contacts",    label: "Customer Contact List",  href: "/reports/customer-contacts",    ready: true  },
      { id: "income-by-customer",   label: "Income by Customer",     href: "/reports/income-by-customer",   ready: true  },
      { id: "product-service-list", label: "Product & Service List", href: "/reports/product-service-list", ready: false },
      { id: "sales-by-product",     label: "Sales by Product",       href: "/reports/sales-by-product",     ready: false },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    reports: [
      { id: "open-pos-by-customer", label: "Open POs by Customer", href: "/reports/open-pos-by-customer", ready: true  },
      { id: "open-pos-by-product",  label: "Open POs by Product",  href: "/reports/open-pos-by-product",  ready: false },
    ],
  },
  {
    id: "what-you-owe",
    label: "What You Owe",
    reports: [
      { id: "ap-aging-summary",       label: "A/P Aging Summary",      href: "/reports/ap-aging-summary",       ready: false },
      { id: "ap-aging-detail",        label: "A/P Aging Detail",       href: "/reports/ap-aging-detail",        ready: false },
      { id: "vendor-balance-summary", label: "Vendor Balance Summary", href: "/reports/vendor-balance-summary", ready: false },
      { id: "vendor-balance-detail",  label: "Vendor Balance Detail",  href: "/reports/vendor-balance-detail",  ready: false },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    reports: [
      { id: "vendor-contacts", label: "Vendor Contact List", href: "/reports/vendor-contacts", ready: true },
      { id: "pos-by-vendor",   label: "POs by Vendor",       href: "/reports/pos-by-vendor",   ready: true },
    ],
  },
];

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

const FAV_KEY = "bza_fav_reports";

// ── Types ─────────────────────────────────────────────────────────────────────
type PreviewRow = Record<string, string | number | null>;

const STATUS_COLORS: Record<string, string> = {
  "delivered":  "bg-emerald-100 text-emerald-700",
  "in transit": "bg-blue-100 text-blue-700",
  "customs":    "bg-amber-100 text-amber-700",
  "scheduled":  "bg-stone-100 text-stone-500",
};

function statusBadge(s: string | null) {
  if (!s) return null;
  const cls = STATUS_COLORS[s.toLowerCase()] ?? "bg-stone-100 text-stone-500";
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

// ── Send to Client panel ──────────────────────────────────────────────────────
function SendToClientPanel() {
  const [clients, setClients] = useState<{ id: number; name: string; contactEmail?: string | null }[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [format, setFormat] = useState<"excel" | "pdf" | "both">("excel");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedCols, setSelectedCols] = useState<string[]>(DEFAULT_COLS);
  const [colsOpen, setColsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<"excel" | "pdf" | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load client list
  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setClients(data); })
      .catch(() => {});
  }, []);

  // Auto-fill email when client changes
  useEffect(() => {
    if (!clientId) { setEmail(""); setPreview([]); return; }
    const c = clients.find(c => c.id === clientId);
    setEmail(c?.contactEmail ?? "");
  }, [clientId, clients]);

  // Fetch preview whenever client or filter changes
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
          clientId,
          email,
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
      if (!res.ok) { setDownloading(null); return; }
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

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0d3d3b] flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-stone-800">Send Report</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-stone-100">
          {/* Controls */}
          <div className="px-5 pt-4 pb-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Client selector */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Client</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20"
                >
                  <option value="">Select client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Recipient email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@client.com"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20"
                />
              </div>
            </div>

            {/* Format + Filter — single row, no wrap */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(["excel","pdf","both"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      format === f
                        ? "bg-[#0d3d3b] text-white border-[#0d3d3b]"
                        : "bg-white text-stone-500 border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    {f === "excel" && <FileSpreadsheet className="w-3 h-3" />}
                    {f === "pdf"   && <FileText className="w-3 h-3" />}
                    {f === "both"  && <><FileSpreadsheet className="w-3 h-3" /><FileText className="w-3 h-3" /></>}
                    {f === "excel" ? "Excel" : f === "pdf" ? "PDF" : "Both"}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-stone-200" />

              <button
                onClick={() => setActiveOnly(v => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <span className={`relative inline-flex w-8 h-4 shrink-0 rounded-full transition-colors ${activeOnly ? "bg-[#0d3d3b]" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${activeOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
                <span className="text-xs text-stone-500 whitespace-nowrap">Active only</span>
              </button>
            </div>
          </div>

          {/* ── Column selector ── */}
          <div className="border-t border-stone-100">
            <button
              onClick={() => setColsOpen(o => !o)}
              className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-stone-50 transition-colors"
            >
              <span className="text-xs font-medium text-stone-500">
                Columns
                <span className="ml-1.5 bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                  {selectedCols.length}/{ALL_COLS.length}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => { e.stopPropagation(); setSelectedCols(ALL_COLS.map(c => c.key)); }}
                  className="text-[10px] text-stone-400 hover:text-[#0d3d3b] transition-colors"
                >
                  All
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedCols(DEFAULT_COLS); }}
                  className="text-[10px] text-stone-400 hover:text-[#0d3d3b] transition-colors"
                >
                  Default
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedCols([]); }}
                  className="text-[10px] text-stone-400 hover:text-[#0d3d3b] transition-colors"
                >
                  None
                </button>
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${colsOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {colsOpen && (
              <div className="px-5 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {ALL_COLS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(col.key)}
                      onChange={e => {
                        setSelectedCols(prev =>
                          e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key)
                        );
                      }}
                      className="w-3.5 h-3.5 accent-[#0d3d3b] cursor-pointer"
                    />
                    <span className="text-xs text-stone-600 group-hover:text-stone-900 transition-colors">{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Preview table ── */}
          {clientId && (
            <div className="border-t border-stone-100">
              <div className="px-5 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                  {!previewLoading && (
                    <span className="bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                      {preview.length} row{preview.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
              </div>

              {!previewLoading && preview.length === 0 && (
                <div className="px-5 py-6 flex flex-col items-center gap-2 text-center">
                  <Package className="w-8 h-8 text-stone-200" />
                  <p className="text-xs text-stone-400">No shipments found for this client with the current filter.</p>
                </div>
              )}

              {!previewLoading && preview.length > 0 && selectedCols.length > 0 && (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
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
                    <tbody className="divide-y divide-stone-50">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          {selectedCols.map(key => {
                            const val = row[key];
                            const display = val === null || val === undefined ? "—" : String(val);
                            return (
                              <td key={key} className="px-3 py-2 text-stone-600 whitespace-nowrap max-w-[160px] truncate">
                                {key === "shipmentStatus" && val
                                  ? statusBadge(display)
                                  : display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!previewLoading && preview.length > 0 && selectedCols.length === 0 && (
                <p className="px-5 pb-4 text-xs text-stone-400">Select at least one column to see the preview.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-3 border-t border-stone-100 flex items-center gap-2 flex-wrap">
            {/* Send */}
            <button
              onClick={send}
              disabled={!clientId || !email || status === "sending" || preview.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0d3d3b] text-white hover:bg-[#0a5c5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "sending"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
              {status === "sending" ? "Sending…" : "Send report"}
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-stone-200 mx-1" />

            {/* Download group label + buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400 font-medium mr-0.5">Download</span>

              <button
                onClick={() => download("excel")}
                disabled={!clientId || preview.length === 0 || downloading !== null}
                title="Download Excel"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-600 hover:border-[#0d3d3b] hover:text-[#0d3d3b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {downloading === "excel"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><Download className="w-3 h-3" /><FileSpreadsheet className="w-3.5 h-3.5" /></>
                }
                .xlsx
              </button>

              <button
                onClick={() => download("pdf")}
                disabled={!clientId || preview.length === 0 || downloading !== null}
                title="Download PDF"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 text-stone-600 hover:border-[#0d3d3b] hover:text-[#0d3d3b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {downloading === "pdf"
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <><Download className="w-3 h-3" /><FileText className="w-3.5 h-3.5" /></>
                }
                .pdf
              </button>
            </div>

            {/* Feedback */}
            {status === "ok" && (
              <div className="flex items-center gap-1.5 text-xs text-[#0d3d3b] font-medium ml-1">
                <CheckCircle2 className="w-4 h-4" />
                Sent successfully
              </div>
            )}
            {status === "err" && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 ml-1">
                <AlertCircle className="w-4 h-4" />
                {errMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsHubPage() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch {}
  }, []);

  function toggleFav(id: string) {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleCollapsed(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const allReports = REPORT_CATEGORIES.flatMap(c => c.reports);
  const favoriteReports = allReports.filter(r => favorites.includes(r.id));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Standard Reports</h1>
      </div>

      {/* Send to Client */}
      <SendToClientPanel />

      {/* Favorites */}
      {favoriteReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-stone-700">Favorites</span>
          </div>
          <div className="divide-y divide-stone-50">
            {favoriteReports.map(r => (
              <ReportRow key={r.id} report={r} isFav={true} onToggleFav={() => toggleFav(r.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Custom Reports */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Custom Reports</span>
          <Link href="/custom-reports" className="text-xs text-[#0d3d3b] hover:underline font-medium">
            + Create new report
          </Link>
        </div>
        <div className="px-5 py-4 text-sm text-stone-400 italic">
          No custom reports yet. Create one from any standard report.
        </div>
      </div>

      {/* Categories */}
      {REPORT_CATEGORIES.map(cat => {
        const open = !collapsed[cat.id];
        return (
          <div key={cat.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleCollapsed(cat.id)}
              className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition-colors"
            >
              <span className="text-sm font-semibold text-stone-800">{cat.label}</span>
              <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-0">
                {cat.reports.map(r => (
                  <ReportRow key={r.id} report={r} isFav={favorites.includes(r.id)} onToggleFav={() => toggleFav(r.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Report row ────────────────────────────────────────────────────────────────
function ReportRow({
  report,
  isFav,
  onToggleFav,
}: {
  report: { id: string; label: string; href: string; ready: boolean };
  isFav: boolean;
  onToggleFav: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 hover:bg-stone-50 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Link href={report.href} className="text-sm text-stone-700 hover:text-[#0d3d3b] hover:underline truncate">
          {report.label}
        </Link>
        {!report.ready && (
          <span className="text-[10px] text-stone-300 italic shrink-0">coming soon</span>
        )}
      </div>
      <button onClick={onToggleFav} className="ml-3 shrink-0 text-stone-300 hover:text-amber-400 transition-colors">
        <Star className={`w-4 h-4 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>
    </div>
  );
}
