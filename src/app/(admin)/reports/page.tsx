"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Star, ChevronDown, Send, Mail, CheckCircle2,
  AlertCircle, FileSpreadsheet, FileText, Loader2,
  ChevronRight, Eye, Package,
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

const DEFAULT_COLS = [
  "poNumber","clientPoNumber","invoiceNumber","item","quantityTons",
  "shipmentDate","shipmentStatus","currentLocation","lastLocationUpdate",
  "estimatedArrival","vehicleId","blNumber","billingDocument","sellPrice",
  "terms","transportType","licenseFsc","chainOfCustody","inputClaim","outputClaim",
];

const FAV_KEY = "bza_fav_reports";

// ── Types ─────────────────────────────────────────────────────────────────────
type PreviewRow = {
  invoiceNumber:    string | null;
  poNumber:         string | null;
  clientPoNumber:   string | null;
  item:             string | null;
  quantityTons:     number;
  shipmentDate:     string | null;
  shipmentStatus:   string | null;
  currentLocation:  string | null;
  estimatedArrival: string | null;
  vehicleId:        string | null;
};

const STATUS_COLORS: Record<string, string> = {
  entregado:  "bg-emerald-100 text-emerald-700",
  "en tránsito": "bg-blue-100 text-blue-700",
  programado: "bg-stone-100 text-stone-500",
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
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [open, setOpen] = useState(false);

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
          columns: DEFAULT_COLS,
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

            {/* Format + Filter */}
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <p className="text-xs font-medium text-stone-500 mb-1.5">Format</p>
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
              </div>

              <div className="flex items-center gap-2 mb-0.5">
                <button
                  onClick={() => setActiveOnly(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${activeOnly ? "bg-[#0d3d3b]" : "bg-stone-200"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${activeOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <span className="text-xs text-stone-500">Active shipments only</span>
              </div>
            </div>
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

              {!previewLoading && preview.length > 0 && (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">Invoice</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">PO</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">Item</th>
                        <th className="px-3 py-2 text-right font-semibold text-stone-500 whitespace-nowrap">Tons</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">Shipment Date</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">Location</th>
                        <th className="px-3 py-2 text-left font-semibold text-stone-500 whitespace-nowrap">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="px-3 py-2 text-stone-700 font-medium whitespace-nowrap">{row.invoiceNumber ?? "—"}</td>
                          <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{row.poNumber ?? "—"}</td>
                          <td className="px-3 py-2 text-stone-600 whitespace-nowrap max-w-[120px] truncate">{row.item ?? "—"}</td>
                          <td className="px-3 py-2 text-right text-stone-700 whitespace-nowrap">{row.quantityTons?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{row.shipmentDate ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{statusBadge(row.shipmentStatus)}</td>
                          <td className="px-3 py-2 text-stone-500 whitespace-nowrap max-w-[120px] truncate">{row.currentLocation ?? "—"}</td>
                          <td className="px-3 py-2 text-stone-500 whitespace-nowrap">{row.estimatedArrival ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Send button */}
          <div className="px-5 py-3 border-t border-stone-100 flex items-center gap-3">
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

            {status === "ok" && (
              <div className="flex items-center gap-1.5 text-xs text-[#0d3d3b] font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Sent successfully
              </div>
            )}
            {status === "err" && (
              <div className="flex items-center gap-1.5 text-xs text-red-500">
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
