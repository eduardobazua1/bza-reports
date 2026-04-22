"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency, formatNumber, formatPercent, shipmentStatusLabels } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceRow = {
  invoiceNumber: string;
  clientName: string;
  supplierName: string;
  poNumber: string;
  invoiceDate: string | null;
  shipmentDate: string | null;
  dueDate: string | null;
  quantityTons: number;
  sellPrice: number;
  buyPrice: number;
  revenue: number;
  costNoFreight: number;
  freight: number;
  cost: number;
  profit: number;
  customerPaymentStatus: string;
  supplierPaymentStatus: string;
  shipmentStatus: string;
  destination: string | null;
  product: string | null;
  transportType: string;
};

type Tab = "ar-aging" | "pl-monthly" | "pl-customer" | "pl-supplier";

type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  const p = d.split("T")[0].split("-");
  return `${p[1].padStart(2,"0")}/${p[2].padStart(2,"0")}/${p[0]}`;
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.floor((Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000);
}

const FIELD_MAP: Record<string, { label: string; get: (r: InvoiceRow) => string }> = {
  customer:   { label: "Customer",        get: r => r.clientName },
  supplier:   { label: "Supplier",        get: r => r.supplierName },
  product:    { label: "Product",         get: r => r.product ?? "" },
  destination:{ label: "Destination",     get: r => r.destination ?? "" },
  transport:  { label: "Transport",       get: r => r.transportType },
  shipStatus: { label: "Shipment Status", get: r => r.shipmentStatus },
  custPay:    { label: "Cust. Payment",   get: r => r.customerPaymentStatus },
  suppPay:    { label: "Supp. Payment",   get: r => r.supplierPaymentStatus },
};


function applyConditions(data: InvoiceRow[], conditions: FilterCondition[]): InvoiceRow[] {
  return data.filter(r => {
    return conditions.every(c => {
      if (!c.field) return true;
      const raw = FIELD_MAP[c.field]?.get(r) ?? "";
      const val = raw.toLowerCase();
      const cv = c.value.toLowerCase();
      if (c.operator === "is")           return val === cv;
      if (c.operator === "is not")       return val !== cv;
      if (c.operator === "contains")     return val.includes(cv);
      if (c.operator === "is empty")     return !raw;
      if (c.operator === "is not empty") return !!raw;
      return true;
    });
  });
}

// ─── Email modal ──────────────────────────────────────────────────────────────

function EmailModal({
  title, tab, cols, dateFrom, dateTo, invoiceNumbers, onClose,
}: { title: string; tab: string; cols: string[]; dateFrom?: string; dateTo?: string; invoiceNumbers?: string[]; onClose: () => void }) {
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState(`BZA Financial Report – ${title}`);
  const [message, setMessage] = useState("");
  const [format,  setFormat]  = useState<"excel"|"pdf"|"both">("excel");
  const [status,  setStatus]  = useState<"idle"|"sending"|"ok"|"error">("idle");
  const [errMsg,  setErrMsg]  = useState("");

  async function send() {
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/reports/financial/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message, title, tab, cols, dateFrom, dateTo, invoiceNumbers, format }),
      });
      const json = await res.json();
      if (res.ok) { setStatus("ok"); }
      else { setStatus("error"); setErrMsg(json.error ?? "Failed to send"); }
    } catch {
      setStatus("error"); setErrMsg("Network error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Email Report</h3>
            <p className="text-xs text-stone-400 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">×</button>
        </div>

        {status === "ok" ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p className="font-semibold text-stone-800">Email sent!</p>
            <p className="text-xs text-stone-500 mt-1">Report delivered to {email}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#0d9488] text-white text-sm rounded-lg hover:bg-[#0d9488]">Done</button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {/* To */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">To</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="recipient@example.com"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Message <span className="text-stone-400">(optional)</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Add a note..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            {/* Format */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-2">Format</label>
              <div className="flex gap-2">
                {(["excel","pdf","both"] as const).map(f => (
                  <button key={f} onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors capitalize ${format===f ? "bg-[#0d9488] text-white border-[#0d9488]" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
                    {f === "both" ? "PDF + Excel" : f === "excel" ? "Excel" : "PDF"}
                  </button>
                ))}
              </div>
            </div>
            {/* Error */}
            {status === "error" && (
              <p className="text-xs text-[#0d3d3b] bg-[#0d3d3b] rounded-lg px-3 py-2">{errMsg}</p>
            )}
            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50">
                Cancel
              </button>
              <button onClick={send} disabled={!email || status==="sending"}
                className="flex-1 py-2 rounded-lg bg-[#0d9488] text-white text-sm font-medium hover:bg-[#0d9488] disabled:opacity-50 flex items-center justify-center gap-2">
                {status === "sending" ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drill-down modal ─────────────────────────────────────────────────────────

// Column definitions for drill-down
const DD_COL_DEFS = [
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "clientName",    label: "Client" },
  { key: "supplierName",  label: "Supplier" },
  { key: "poNumber",      label: "PO #" },
  { key: "product",       label: "Product" },
  { key: "destination",   label: "Destination" },
  { key: "date",          label: "Date" },
  { key: "dueDate",       label: "Due Date" },
  { key: "days",          label: "Days" },
  { key: "tons",          label: "Tons" },
  { key: "amount",        label: "Amount" },
  { key: "cost",          label: "Cost" },
  { key: "profit",        label: "Profit" },
  { key: "margin",        label: "Margin %" },
  { key: "shipStatus",    label: "Ship Status" },
  { key: "custPayment",   label: "Payment" },
];
const AR_DEFAULT_COLS  = new Set(["invoiceNumber","clientName","poNumber","product","destination","date","dueDate","days","tons","amount","custPayment"]);
const PL_DEFAULT_COLS  = new Set(["invoiceNumber","clientName","supplierName","product","destination","date","dueDate","tons","amount","cost","profit","shipStatus","custPayment"]);

function DrillDownModal({
  title, rows, onClose, onEmail, mode = "pl",
}: { title: string; rows: InvoiceRow[]; onClose: () => void; onEmail: () => void; mode?: "ar" | "pl" }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [colsOpen,    setColsOpen]    = useState(false);
  const [visible, setVisible] = useState<Set<string>>(() => mode === "ar" ? new Set(AR_DEFAULT_COLS) : new Set(PL_DEFAULT_COLS));
  const v = (k: string) => visible.has(k);

  function toggleCol(k: string) {
    setVisible(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  }

  function downloadCSV() {
    const activeCols = DD_COL_DEFS.filter(c => visible.has(c.key));
    const headers = activeCols.map(c => c.label);
    const csvRows = [
      headers,
      ...rows.map(r => {
        const days = daysOverdue(r.dueDate);
        const vals: Record<string, string> = {
          invoiceNumber: r.invoiceNumber, clientName: r.clientName, supplierName: r.supplierName,
          poNumber: r.poNumber, product: r.product ?? "", destination: r.destination ?? "",
          date: r.invoiceDate ?? r.shipmentDate ?? "",
          dueDate: r.dueDate ?? "",
          days: days <= 0 ? "Not due" : `${days}`,
          tons: r.quantityTons.toFixed(3), amount: r.revenue.toFixed(2),
          cost: r.cost.toFixed(2), profit: r.profit.toFixed(2),
          margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(2) : "0",
          shipStatus: shipmentStatusLabels[r.shipmentStatus] ?? r.shipmentStatus,
          custPayment: r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid",
        };
        return activeCols.map(c => vals[c.key]);
      }),
    ];
    const csv = csvRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BZA_${title.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totTons   = rows.reduce((s,r) => s + r.quantityTons, 0);
  const totRev    = rows.reduce((s,r) => s + r.revenue, 0);
  const totCost   = rows.reduce((s,r) => s + r.cost, 0);
  const totProfit = rows.reduce((s,r) => s + r.profit, 0);

  function openPdf(disposition: "inline" | "attachment") {
    // Derive tab from mode so the server fetches the right data
    const tab = mode === "ar" ? "ar-aging" : "pl-customer";
    const cols = Array.from(visible).join(",");
    const params = new URLSearchParams({ tab, cols, disposition });
    const url = `/api/reports/financial/pdf?${params}`;
    if (disposition === "inline") {
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `BZA_${title.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
            <p className="text-xs text-stone-400 mt-0.5">{rows.length} invoice{rows.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">

            {/* Columns toggle */}
            <div className="relative">
              <button onClick={() => { setColsOpen(o => !o); setActionsOpen(false); }}
                className="flex items-center gap-1.5 text-xs border border-stone-200 bg-white rounded-md px-2.5 py-1.5 hover:bg-stone-50 text-stone-600 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                Columns
              </button>
              {colsOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-stone-200 rounded-lg shadow-lg z-30 py-2 px-1 max-h-72 overflow-y-auto"
                  onClick={e => e.stopPropagation()}>
                  {DD_COL_DEFS.map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-stone-50 rounded cursor-pointer">
                      <input type="checkbox" checked={visible.has(c.key)} onChange={() => toggleCol(c.key)}
                        className="w-3.5 h-3.5 accent-blue-600 shrink-0"/>
                      <span className="text-sm text-stone-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Action dropdown */}
            <div className="relative">
              <button onClick={() => { setActionsOpen(o => !o); setColsOpen(false); }}
                className="flex items-center gap-1.5 text-xs border border-stone-200 bg-white rounded-md px-2.5 py-1.5 hover:bg-stone-50 text-stone-600 font-medium">
                Action
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </button>
              {actionsOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-stone-200 rounded-lg shadow-lg z-30 py-1"
                  onClick={() => setActionsOpen(false)}>
                  <button onClick={() => openPdf("inline")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                    <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Preview PDF
                  </button>
                  <button onClick={() => openPdf("attachment")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                    <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    Download PDF
                  </button>
                  <button onClick={downloadCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                    <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Download CSV
                  </button>
                  <div className="border-t border-stone-100 my-1"/>
                  <button onClick={onEmail}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                    <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    Email Report
                  </button>
                </div>
              )}
            </div>

            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none ml-1">×</button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0 border-b-2 border-gray-200">
              <tr>
                {v("invoiceNumber") && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Invoice #</th>}
                {v("clientName")    && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Client</th>}
                {v("supplierName")  && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Supplier</th>}
                {v("poNumber")      && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">PO #</th>}
                {v("product")       && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Product</th>}
                {v("destination")   && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Destination</th>}
                {v("date")          && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Date</th>}
                {v("dueDate")       && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Due Date</th>}
                {v("days")          && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Days</th>}
                {v("tons")          && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Tons</th>}
                {v("amount")        && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Amount</th>}
                {v("cost")          && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Cost</th>}
                {v("profit")        && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Profit</th>}
                {v("margin")        && <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 whitespace-nowrap">Margin %</th>}
                {v("shipStatus")    && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Ship Status</th>}
                {v("custPayment")   && <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">Payment</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const days = daysOverdue(r.dueDate);
                const margin = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    {v("invoiceNumber") && <td className="px-3 py-1.5 font-mono font-medium text-[#0d9488] whitespace-nowrap">{r.invoiceNumber}</td>}
                    {v("clientName")    && <td className="px-3 py-1.5 font-medium whitespace-nowrap">{r.clientName}</td>}
                    {v("supplierName")  && <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.supplierName}</td>}
                    {v("poNumber")      && <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{r.poNumber || "—"}</td>}
                    {v("product")       && <td className="px-3 py-1.5 text-gray-600">{r.product || "—"}</td>}
                    {v("destination")   && <td className="px-3 py-1.5 text-gray-600">{r.destination || "—"}</td>}
                    {v("date")          && <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{fmtDate(r.invoiceDate ?? r.shipmentDate)}</td>}
                    {v("dueDate")       && <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{fmtDate(r.dueDate)}</td>}
                    {v("days")          && <td className={`px-3 py-1.5 text-right font-medium whitespace-nowrap ${days > 90 ? "text-[#0d3d3b]" : days > 30 ? "text-[#0d9488]" : days > 0 ? "text-[#0d9488]" : "text-gray-400"}`}>{days <= 0 ? "—" : `${days}d`}</td>}
                    {v("tons")          && <td className="px-3 py-1.5 text-right text-gray-700">{formatNumber(r.quantityTons, 1)}</td>}
                    {v("amount")        && <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(r.revenue)}</td>}
                    {v("cost")          && <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(r.cost)}</td>}
                    {v("profit")        && <td className={`px-3 py-1.5 text-right font-medium ${r.profit < 0 ? "text-[#0d3d3b]" : ""}`}>{formatCurrency(r.profit)}</td>}
                    {v("margin")        && <td className={`px-3 py-1.5 text-right ${margin < 0 ? "text-[#0d3d3b]" : "text-gray-600"}`}>{formatPercent(margin)}</td>}
                    {v("shipStatus")    && <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{shipmentStatusLabels[r.shipmentStatus] ?? r.shipmentStatus}</td>}
                    {v("custPayment")   && <td className={`px-3 py-1.5 font-medium ${r.customerPaymentStatus === "paid" ? "text-gray-600" : "text-[#0d3d3b]"}`}>{r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid"}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-300">
              <tr>
                {/* Span all non-numeric cols up to tons */}
                <td colSpan={DD_COL_DEFS.filter(c => !["tons","amount","cost","profit","margin","shipStatus","custPayment"].includes(c.key) && visible.has(c.key)).length || 1}
                  className="px-3 py-2 font-semibold text-xs text-gray-600 uppercase tracking-wide">TOTAL</td>
                {v("tons")    && <td className="px-3 py-2 text-right font-semibold">{formatNumber(totTons, 1)}</td>}
                {v("amount")  && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totRev)}</td>}
                {v("cost")    && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totCost)}</td>}
                {v("profit")  && <td className={`px-3 py-2 text-right font-semibold ${totProfit < 0 ? "text-[#0d3d3b]" : ""}`}>{formatCurrency(totProfit)}</td>}
                {v("margin")  && <td className={`px-3 py-2 text-right font-semibold ${totProfit < 0 ? "text-[#0d3d3b]" : ""}`}>{formatPercent(totRev > 0 ? (totProfit / totRev) * 100 : 0)}</td>}
                {v("shipStatus")  && <td />}
                {v("custPayment") && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Customize panel ──────────────────────────────────────────────────────────

const OPERATORS = ["is","is not","contains","is empty","is not empty"];

function CustomizePanel({
  open, onClose, conditions, onAdd, onUpdate, onRemove, onClear,
  cols, visible, onToggleCol,
}: {
  open: boolean; onClose: () => void;
  conditions: FilterCondition[];
  onAdd: () => void; onUpdate: (id: string, k: keyof FilterCondition, v: string) => void;
  onRemove: (id: string) => void; onClear: () => void;
  cols: { key: string; label: string }[];
  visible: Set<string>; onToggleCol: (k: string) => void;
}) {
  const [tab, setTab] = useState<"data"|"visual">("data");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-stone-200 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-800">Customize</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100">
          {(["data","visual"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${tab===t ? "border-[#0d9488] text-[#0d9488]" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              {t === "data" ? "Data" : "Visual"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {tab === "data" && (
            <>
              {/* Filters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-1">
                    Filters
                    <span className="text-[10px] bg-stone-100 text-stone-500 rounded-full w-4 h-4 flex items-center justify-center">?</span>
                  </h3>
                  {conditions.length > 0 && (
                    <button onClick={onClear} className="text-xs text-[#0d9488] hover:underline">Clear all</button>
                  )}
                </div>
                <p className="text-xs text-stone-400 mb-3">Select how you want to filter your data.</p>

                {conditions.map((c) => (
                  <div key={c.id} className="space-y-2 mb-3 p-3 bg-stone-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <select value={c.field} onChange={e => onUpdate(c.id,"field",e.target.value)}
                        className="flex-1 border border-stone-200 rounded px-2 py-1.5 text-xs bg-white">
                        <option value="">— Field —</option>
                        {Object.entries(FIELD_MAP).map(([k,v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <button onClick={() => onRemove(c.id)} className="text-stone-300 hover:text-[#0d3d3b] text-lg leading-none shrink-0">⊗</button>
                    </div>
                    <select value={c.operator} onChange={e => onUpdate(c.id,"operator",e.target.value)}
                      className="w-full border border-stone-200 rounded px-2 py-1.5 text-xs bg-white">
                      {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                    {c.operator !== "is empty" && c.operator !== "is not empty" && (
                      <input value={c.value} onChange={e => onUpdate(c.id,"value",e.target.value)}
                        placeholder="Value..."
                        className="w-full border border-stone-200 rounded px-2 py-1.5 text-xs" />
                    )}
                  </div>
                ))}

                <button onClick={onAdd}
                  className="text-xs text-[#0d9488] hover:underline font-medium">
                  + Add another filter
                </button>
              </div>
            </>
          )}

          {tab === "visual" && (
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Columns</h3>
              <p className="text-xs text-stone-400 mb-3">Show or hide columns in the report.</p>
              <div className="space-y-1">
                {cols.map(c => (
                  <label key={c.key} className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 px-1 py-1.5 rounded">
                    <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600"
                      checked={visible.has(c.key)} onChange={() => onToggleCol(c.key)} />
                    <span className="text-sm text-stone-700">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-stone-100">
          <button onClick={onClose} className="w-full bg-[#0d9488] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#0d9488]">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clickable amount cell ─────────────────────────────────────────────────────

function AmountCell({ value, rows, onDrillDown, className }: {
  value: number; rows: InvoiceRow[]; onDrillDown: (rows: InvoiceRow[], title: string) => void; className?: string;
}) {
  if (value === 0 || rows.length === 0) return <td className={`px-3 py-1.5 text-right text-gray-300 ${className??""}`}>—</td>;
  return (
    <td className={`px-3 py-1.5 text-right ${className??""}`}>
      <button onClick={() => onDrillDown(rows, `${rows.length} invoices`)}
        className="text-[#0d9488] hover:underline cursor-pointer">
        {formatCurrency(value)}
      </button>
    </td>
  );
}

// ─── AR Aging (QB document style) ─────────────────────────────────────────────

function ARAgingReport({ data, visible, onDrillDown }: {
  data: InvoiceRow[];
  visible: Set<string>;
  onDrillDown: (rows: InvoiceRow[], title: string) => void;
}) {
  const [sortCol, setSortCol] = useState("total");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const v = (k: string) => visible.has(k);

  const _tn = new Date(); const today = `${String(_tn.getMonth()+1).padStart(2,"0")}/${String(_tn.getDate()).padStart(2,"0")}/${_tn.getFullYear()}`;

  // Group by client
  const clientMap = new Map<string, { current: InvoiceRow[]; d30: InvoiceRow[]; d60: InvoiceRow[]; d90: InvoiceRow[]; d91: InvoiceRow[] }>();
  data.filter(r => r.customerPaymentStatus === "unpaid").forEach(r => {
    const name = r.clientName;
    if (!clientMap.has(name)) clientMap.set(name, { current:[], d30:[], d60:[], d90:[], d91:[] });
    const b = clientMap.get(name)!;
    const days = daysOverdue(r.dueDate);
    if (days <= 0) b.current.push(r);
    else if (days <= 30) b.d30.push(r);
    else if (days <= 60) b.d60.push(r);
    else if (days <= 90) b.d90.push(r);
    else b.d91.push(r);
  });

  const sum = (rows: InvoiceRow[]) => rows.reduce((s,r) => s+r.revenue, 0);

  const rows = Array.from(clientMap.entries()).map(([name, b]) => ({
    name, ...b,
    current_v: sum(b.current), d30_v: sum(b.d30), d60_v: sum(b.d60), d90_v: sum(b.d90), d91_v: sum(b.d91),
    total: sum([...b.current,...b.d30,...b.d60,...b.d90,...b.d91]),
    allRows: [...b.current,...b.d30,...b.d60,...b.d90,...b.d91],
  })).sort((a,b) => {
    const va = (a as Record<string,number>)[sortCol] ?? 0;
    const vb = (b as Record<string,number>)[sortCol] ?? 0;
    const cmp = typeof va === "string" ? (va as string).localeCompare(vb as string) : va - vb;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totals = {
    current: rows.reduce((s,r)=>s+r.current_v,0), d30: rows.reduce((s,r)=>s+r.d30_v,0),
    d60: rows.reduce((s,r)=>s+r.d60_v,0), d90: rows.reduce((s,r)=>s+r.d90_v,0),
    d91: rows.reduce((s,r)=>s+r.d91_v,0), total: rows.reduce((s,r)=>s+r.total,0),
  };

  function SortTH({ label, col, right }: { label: string; col: string; right?: boolean }) {
    const active = sortCol === col;
    return (
      <th onClick={() => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else {setSortCol(col);setSortDir("desc");} }}
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:bg-gray-50 ${right?"text-right":"text-left"} ${active?"text-gray-800":"text-gray-500"}`}>
        {label} {active ? <span className="text-[9px] opacity-60">{sortDir==="asc"?"▲":"▼"}</span> : null}
      </th>
    );
  }

  return (
    <div className="bg-white">
      {/* Document header */}
      <div className="text-center pt-5 pb-3 px-6 border-b border-gray-200">
        <p className="text-[11px] text-gray-400">BZA International Services, LLC</p>
        <h2 className="text-base font-semibold text-gray-800 mt-0.5">A/R Aging Summary Report</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">As of {today}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <SortTH label="Customer" col="name" />
              {v("current") && <SortTH label="Current" col="current_v" right />}
              {v("d30")     && <SortTH label="1 - 30" col="d30_v" right />}
              {v("d60")     && <SortTH label="31 - 60" col="d60_v" right />}
              {v("d90")     && <SortTH label="61 - 90" col="d90_v" right />}
              {v("d91")     && <SortTH label="91 and over" col="d91_v" right />}
              <SortTH label="Total" col="total" right />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">No outstanding receivables.</td></tr>}
            {rows.map(r => (
              <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 font-medium">
                  <button onClick={() => onDrillDown(r.allRows, r.name)} className="text-[#0d9488] hover:underline">
                    {r.name}
                  </button>
                </td>
                {v("current") && <AmountCell value={r.current_v} rows={r.current} onDrillDown={(rows) => onDrillDown(rows, `${r.name} — Current`)} />}
                {v("d30")     && <AmountCell value={r.d30_v}     rows={r.d30}     onDrillDown={(rows) => onDrillDown(rows, `${r.name} — 1-30 days`)} />}
                {v("d60")     && <AmountCell value={r.d60_v}     rows={r.d60}     onDrillDown={(rows) => onDrillDown(rows, `${r.name} — 31-60 days`)} />}
                {v("d90")     && <AmountCell value={r.d90_v}     rows={r.d90}     onDrillDown={(rows) => onDrillDown(rows, `${r.name} — 61-90 days`)} />}
                {v("d91")     && <AmountCell value={r.d91_v}     rows={r.d91}     onDrillDown={(rows) => onDrillDown(rows, `${r.name} — 91+ days`)} className="text-[#0d3d3b]" />}
                <td className="px-3 py-1.5 text-right font-medium">
                  <button onClick={() => onDrillDown(r.allRows, r.name)} className="text-[#0d9488] hover:underline">
                    {formatCurrency(r.total)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td className="px-3 py-2 font-semibold text-xs text-gray-600 uppercase tracking-wide">TOTAL</td>
              {v("current") && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.current)}</td>}
              {v("d30")     && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.d30)}</td>}
              {v("d60")     && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.d60)}</td>}
              {v("d90")     && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.d90)}</td>}
              {v("d91")     && <td className="px-3 py-2 text-right font-semibold text-[#0d3d3b]">{formatCurrency(totals.d91)}</td>}
              <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
        {new Date().toLocaleString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit", timeZoneName:"short" })}
      </div>
    </div>
  );
}

// ─── P&L Monthly (QB document style) ─────────────────────────────────────────

function PLMonthlyReport({ data, visible, onDrillDown }: {
  data: InvoiceRow[];
  visible: Set<string>;
  onDrillDown: (rows: InvoiceRow[], title: string) => void;
}) {
  const [sortCol, setSortCol] = useState("key");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const v = (k: string) => visible.has(k);

  const map = new Map<string, InvoiceRow[]>();
  data.forEach(r => {
    const d = r.shipmentDate || r.invoiceDate;
    if (!d) return;
    const key = d.slice(0,7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  const months = Array.from(map.entries()).map(([key, rows]) => ({
    key,
    label: new Date(key+"-15").toLocaleDateString("en-US",{month:"short",year:"numeric"}),
    rows,
    invoices: rows.length,
    tons: rows.reduce((s,r)=>s+r.quantityTons,0),
    revenue: rows.reduce((s,r)=>s+r.revenue,0),
    cost: rows.reduce((s,r)=>s+r.cost,0),
    costNoFreight: rows.reduce((s,r)=>s+r.costNoFreight,0),
    freight: rows.reduce((s,r)=>s+r.freight,0),
    profit: rows.reduce((s,r)=>s+r.profit,0),
  })).map(m => ({...m, margin: m.revenue>0?(m.profit/m.revenue)*100:0, avgSell:m.tons>0?m.revenue/m.tons:0}))
    .sort((a,b) => {
      const va = (a as Record<string,string|number>)[sortCol] ?? 0;
      const vb = (b as Record<string,string|number>)[sortCol] ?? 0;
      const cmp = typeof va==="string" ? va.localeCompare(vb as string) : (va as number)-(vb as number);
      return sortDir==="asc"?cmp:-cmp;
    });

  const totals = { invoices:0, tons:0, revenue:0, cost:0, profit:0, freight:0 };
  months.forEach(m => { totals.invoices+=m.invoices; totals.tons+=m.tons; totals.revenue+=m.revenue; totals.cost+=m.cost; totals.profit+=m.profit; totals.freight+=m.freight; });

  function SortTH({ label, col, right }: { label:string; col:string; right?:boolean }) {
    const active = sortCol===col;
    return (
      <th onClick={()=>{if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("desc");}}}
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:bg-gray-50 ${right?"text-right":"text-left"} ${active?"text-gray-800":"text-gray-500"}`}>
        {label} {active ? <span className="text-[9px] opacity-60">{sortDir==="asc"?"▲":"▼"}</span> : null}
      </th>
    );
  }

  const period = months.length > 0 ? `${months[0].label} – ${months[months.length-1].label}` : "All time";

  return (
    <div className="bg-white">
      <div className="text-center pt-5 pb-3 px-6 border-b border-gray-200">
        <p className="text-[11px] text-gray-400">BZA International Services, LLC</p>
        <h2 className="text-base font-semibold text-gray-800 mt-0.5">Profit and Loss by Month</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">{period}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <SortTH label="Month" col="key" />
              {v("invoices") && <SortTH label="Invoices" col="invoices" right />}
              {v("tons")     && <SortTH label="Tons" col="tons" right />}
              {v("revenue")  && <SortTH label="Revenue" col="revenue" right />}
              {v("costNoFreight") && <SortTH label="Cost (ex-freight)" col="costNoFreight" right />}
              {v("freight")  && <SortTH label="Freight" col="freight" right />}
              {v("totalCost")&& <SortTH label="Total Cost" col="cost" right />}
              {v("profit")   && <SortTH label="Profit" col="profit" right />}
              {v("margin")   && <SortTH label="Margin %" col="margin" right />}
              {v("avgSell")  && <SortTH label="Avg Sell/TN" col="avgSell" right />}
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">No data.</td></tr>}
            {months.map(m => (
              <tr key={m.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 font-medium">
                  <button onClick={()=>onDrillDown(m.rows, m.label)} className="text-[#0d9488] hover:underline">{m.label}</button>
                </td>
                {v("invoices") && <td className="px-3 py-1.5 text-right">
                  <button onClick={()=>onDrillDown(m.rows,m.label)} className="text-[#0d9488] hover:underline">{m.invoices}</button>
                </td>}
                {v("tons")     && <td className="px-3 py-1.5 text-right text-gray-700">{formatNumber(m.tons,1)}</td>}
                {v("revenue")  && <AmountCell value={m.revenue} rows={m.rows} onDrillDown={r=>onDrillDown(r,`${m.label} — Revenue`)} />}
                {v("costNoFreight") && <AmountCell value={m.costNoFreight} rows={m.rows} onDrillDown={r=>onDrillDown(r,`${m.label} — Cost`)} />}
                {v("freight")  && <AmountCell value={m.freight} rows={m.rows} onDrillDown={r=>onDrillDown(r,`${m.label} — Freight`)} />}
                {v("totalCost")&& <AmountCell value={m.cost} rows={m.rows} onDrillDown={r=>onDrillDown(r,`${m.label} — Total Cost`)} />}
                {v("profit")   && <td className="px-3 py-1.5 text-right">
                  <button onClick={()=>onDrillDown(m.rows,`${m.label} — Profit`)} className={`hover:underline ${m.profit<0?"text-[#0d3d3b]":""}`}>{formatCurrency(m.profit)}</button>
                </td>}
                {v("margin")   && <td className={`px-3 py-1.5 text-right ${m.margin<0?"text-[#0d3d3b]":"text-gray-700"}`}>{formatPercent(m.margin)}</td>}
                {v("avgSell")  && <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(m.avgSell)}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td className="px-3 py-2 font-semibold text-xs text-gray-600 uppercase tracking-wide">TOTAL</td>
              {v("invoices") && <td className="px-3 py-2 text-right font-semibold">{totals.invoices}</td>}
              {v("tons")     && <td className="px-3 py-2 text-right font-semibold">{formatNumber(totals.tons,1)}</td>}
              {v("revenue")  && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.revenue)}</td>}
              {v("costNoFreight") && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(months.reduce((s,m)=>s+m.costNoFreight,0))}</td>}
              {v("freight")  && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.freight)}</td>}
              {v("totalCost")&& <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.cost)}</td>}
              {v("profit")   && <td className={`px-3 py-2 text-right font-semibold ${totals.profit<0?"text-[#0d3d3b]":""}`}>{formatCurrency(totals.profit)}</td>}
              {v("margin")   && <td className={`px-3 py-2 text-right font-semibold ${totals.profit<0?"text-[#0d3d3b]":""}`}>{formatPercent(totals.revenue>0?(totals.profit/totals.revenue)*100:0)}</td>}
              {v("avgSell")  && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(totals.tons>0?totals.revenue/totals.tons:0)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── P&L by Entity (Client or Supplier) ──────────────────────────────────────

function PLEntityReport({ data, isClient, visible, onDrillDown }: {
  data: InvoiceRow[]; isClient: boolean;
  visible: Set<string>;
  onDrillDown: (rows: InvoiceRow[], title: string) => void;
}) {
  const [sortCol, setSortCol] = useState("revenue");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const v = (k: string) => visible.has(k);
  const nameKey = isClient ? "clientName" : "supplierName";
  const payKey  = isClient ? "customerPaymentStatus" : "supplierPaymentStatus";

  const map = new Map<string, InvoiceRow[]>();
  data.forEach(r => {
    const name = r[nameKey];
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(r);
  });

  const entities = Array.from(map.entries()).map(([name, rows]) => {
    const revenue = rows.reduce((s,r)=>s+r.revenue,0);
    const cost = rows.reduce((s,r)=>s+r.cost,0);
    const profit = revenue - cost;
    const tons = rows.reduce((s,r)=>s+r.quantityTons,0);
    const unpaid = rows.filter(r=>r[payKey]==="unpaid");
    return {
      name, rows, revenue, cost, profit, tons,
      costNoFreight: rows.reduce((s,r)=>s+r.costNoFreight,0),
      freight: rows.reduce((s,r)=>s+r.freight,0),
      margin: revenue>0?(profit/revenue)*100:0,
      marginTon: tons>0?profit/tons:0,
      avgSell: tons>0?revenue/tons:0,
      avgBuy: tons>0?rows.reduce((s,r)=>s+r.costNoFreight,0)/tons:0,
      receivable: unpaid.reduce((s,r)=>s+r.revenue,0),
      paidInv: rows.filter(r=>r[payKey]==="paid").length,
      unpaidInv: unpaid.length,
    };
  }).sort((a,b) => {
    const va = (a as Record<string,string|number>)[sortCol]??0;
    const vb = (b as Record<string,string|number>)[sortCol]??0;
    const cmp = typeof va==="string"?va.localeCompare(vb as string):(va as number)-(vb as number);
    return sortDir==="asc"?cmp:-cmp;
  });

  const T = entities.reduce((a,e)=>({revenue:a.revenue+e.revenue,cost:a.cost+e.cost,profit:a.profit+e.profit,tons:a.tons+e.tons,freight:a.freight+e.freight,costNoFreight:a.costNoFreight+e.costNoFreight,receivable:a.receivable+e.receivable}),{revenue:0,cost:0,profit:0,tons:0,freight:0,costNoFreight:0,receivable:0});

  function SortTH({ label, col, right }: { label:string; col:string; right?:boolean }) {
    const active = sortCol===col;
    return (
      <th onClick={()=>{if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("desc");}}}
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap cursor-pointer select-none hover:bg-gray-50 ${right?"text-right":"text-left"} ${active?"text-gray-800":"text-gray-500"}`}>
        {label} {active ? <span className="text-[9px] opacity-60">{sortDir==="asc"?"▲":"▼"}</span> : null}
      </th>
    );
  }

  return (
    <div className="bg-white">
      <div className="text-center pt-5 pb-3 px-6 border-b border-gray-200">
        <p className="text-[11px] text-gray-400">BZA International Services, LLC</p>
        <h2 className="text-base font-semibold text-gray-800 mt-0.5">Profit and Loss by {isClient?"Customer":"Supplier"}</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">All time</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <SortTH label={isClient?"Customer":"Supplier"} col="name" />
              {v("invoices")      && <SortTH label="Invoices" col="rows.length" right />}
              {v("tons")          && <SortTH label="Tons" col="tons" right />}
              {v("revenue")       && <SortTH label="Revenue" col="revenue" right />}
              {v("costNoFreight") && <SortTH label="Cost (ex-freight)" col="costNoFreight" right />}
              {v("freight")       && <SortTH label="Freight" col="freight" right />}
              {v("totalCost")     && <SortTH label="Total Cost" col="cost" right />}
              {v("profit")        && <SortTH label="Profit" col="profit" right />}
              {v("margin")        && <SortTH label="Margin %" col="margin" right />}
              {v("avgSell")       && <SortTH label="Avg Sell/TN" col="avgSell" right />}
              {v("avgBuy")        && <SortTH label="Avg Buy/TN" col="avgBuy" right />}
              {v("marginTon")     && <SortTH label="Margin/TN" col="marginTon" right />}
              {(v("receivable")||v("payable")) && <SortTH label={isClient?"Receivable":"Payable"} col="receivable" right />}
              {v("paidInv")       && <SortTH label="Paid" col="paidInv" right />}
              {v("unpaidInv")     && <SortTH label="Unpaid" col="unpaidInv" right />}
            </tr>
          </thead>
          <tbody>
            {entities.length===0 && <tr><td colSpan={16} className="px-3 py-8 text-center text-gray-400">No data.</td></tr>}
            {entities.map(e => (
              <tr key={e.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 font-medium">
                  <button onClick={()=>onDrillDown(e.rows, e.name)} className="text-[#0d9488] hover:underline">{e.name}</button>
                </td>
                {v("invoices")      && <td className="px-3 py-1.5 text-right"><button onClick={()=>onDrillDown(e.rows,e.name)} className="text-[#0d9488] hover:underline">{e.rows.length}</button></td>}
                {v("tons")          && <td className="px-3 py-1.5 text-right text-gray-700">{formatNumber(e.tons,1)}</td>}
                {v("revenue")       && <AmountCell value={e.revenue} rows={e.rows} onDrillDown={r=>onDrillDown(r,`${e.name} — Revenue`)} />}
                {v("costNoFreight") && <AmountCell value={e.costNoFreight} rows={e.rows} onDrillDown={r=>onDrillDown(r,`${e.name} — Cost`)} />}
                {v("freight")       && <AmountCell value={e.freight} rows={e.rows} onDrillDown={r=>onDrillDown(r,`${e.name} — Freight`)} />}
                {v("totalCost")     && <AmountCell value={e.cost} rows={e.rows} onDrillDown={r=>onDrillDown(r,`${e.name} — Total Cost`)} />}
                {v("profit")        && <td className="px-3 py-1.5 text-right"><button onClick={()=>onDrillDown(e.rows,`${e.name} — Profit`)} className={`hover:underline ${e.profit<0?"text-[#0d3d3b]":""}`}>{formatCurrency(e.profit)}</button></td>}
                {v("margin")        && <td className={`px-3 py-1.5 text-right ${e.margin<0?"text-[#0d3d3b]":"text-gray-700"}`}>{formatPercent(e.margin)}</td>}
                {v("avgSell")       && <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(e.avgSell)}</td>}
                {v("avgBuy")        && <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(e.avgBuy)}</td>}
                {v("marginTon")     && <td className={`px-3 py-1.5 text-right ${e.marginTon<0?"text-[#0d3d3b]":"text-gray-700"}`}>{formatCurrency(e.marginTon)}</td>}
                {(v("receivable")||v("payable")) && <AmountCell value={e.receivable} rows={e.rows.filter(r=>r[payKey]==="unpaid")} onDrillDown={r=>onDrillDown(r,`${e.name} — ${isClient?"Receivable":"Payable"}`)} className="text-[#0d3d3b]" />}
                {v("paidInv")       && <td className="px-3 py-1.5 text-right text-gray-700">{e.paidInv}</td>}
                {v("unpaidInv")     && <td className={`px-3 py-1.5 text-right ${e.unpaidInv>0?"text-[#0d3d3b]":"text-gray-400"}`}>{e.unpaidInv}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td className="px-3 py-2 font-semibold text-xs text-gray-600 uppercase tracking-wide">TOTAL</td>
              {v("invoices")      && <td className="px-3 py-2 text-right font-semibold">{entities.reduce((s,e)=>s+e.rows.length,0)}</td>}
              {v("tons")          && <td className="px-3 py-2 text-right font-semibold">{formatNumber(T.tons,1)}</td>}
              {v("revenue")       && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.revenue)}</td>}
              {v("costNoFreight") && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.costNoFreight)}</td>}
              {v("freight")       && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.freight)}</td>}
              {v("totalCost")     && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.cost)}</td>}
              {v("profit")        && <td className={`px-3 py-2 text-right font-semibold ${T.profit<0?"text-[#0d3d3b]":""}`}>{formatCurrency(T.profit)}</td>}
              {v("margin")        && <td className={`px-3 py-2 text-right font-semibold ${T.profit<0?"text-[#0d3d3b]":""}`}>{formatPercent(T.revenue>0?(T.profit/T.revenue)*100:0)}</td>}
              {v("avgSell")       && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.tons>0?T.revenue/T.tons:0)}</td>}
              {v("avgBuy")        && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(T.tons>0?T.costNoFreight/T.tons:0)}</td>}
              {v("marginTon")     && <td className={`px-3 py-2 text-right font-semibold ${T.profit<0?"text-[#0d3d3b]":""}`}>{formatCurrency(T.tons>0?T.profit/T.tons:0)}</td>}
              {(v("receivable")||v("payable")) && <td className="px-3 py-2 text-right font-semibold text-[#0d3d3b]">{formatCurrency(T.receivable)}</td>}
              {v("paidInv")       && <td className="px-3 py-2 text-right font-semibold">{entities.reduce((s,e)=>s+e.paidInv,0)}</td>}
              {v("unpaidInv")     && <td className="px-3 py-2 text-right font-semibold text-[#0d3d3b]">{entities.reduce((s,e)=>s+e.unpaidInv,0)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const AR_COLS    = [{ key:"current",label:"Current"},{key:"d30",label:"1-30"},{key:"d60",label:"31-60"},{key:"d90",label:"61-90"},{key:"d91",label:"91+"}];
const MONTHLY_COLS=[{key:"invoices",label:"Invoices"},{key:"tons",label:"Tons"},{key:"revenue",label:"Revenue"},{key:"costNoFreight",label:"Cost (ex-freight)"},{key:"freight",label:"Freight"},{key:"totalCost",label:"Total Cost"},{key:"profit",label:"Profit"},{key:"margin",label:"Margin %"},{key:"avgSell",label:"Avg Sell/TN"}];
const CLIENT_COLS =[{key:"invoices",label:"Invoices"},{key:"tons",label:"Tons"},{key:"revenue",label:"Revenue"},{key:"costNoFreight",label:"Cost (ex-freight)"},{key:"freight",label:"Freight"},{key:"totalCost",label:"Total Cost"},{key:"profit",label:"Profit"},{key:"margin",label:"Margin %"},{key:"avgSell",label:"Avg Sell/TN"},{key:"avgBuy",label:"Avg Buy/TN"},{key:"marginTon",label:"Margin/TN"},{key:"receivable",label:"Receivable"},{key:"paidInv",label:"Paid"},{key:"unpaidInv",label:"Unpaid"}];
const SUPPLIER_COLS=[{key:"invoices",label:"Invoices"},{key:"tons",label:"Tons"},{key:"revenue",label:"Revenue"},{key:"costNoFreight",label:"Cost (ex-freight)"},{key:"freight",label:"Freight"},{key:"totalCost",label:"Total Cost"},{key:"profit",label:"Profit"},{key:"margin",label:"Margin %"},{key:"avgBuy",label:"Avg Buy/TN"},{key:"marginTon",label:"Margin/TN"},{key:"payable",label:"Payable"},{key:"paidInv",label:"Paid"},{key:"unpaidInv",label:"Unpaid"}];

const REPORT_CATALOG = [
  { category:"Business Overview", reports:[{ id:"pl-monthly"  as Tab, label:"Profit and Loss by Month",      description:"Revenue, cost and profit broken down by calendar month" }] },
  { category:"Who Owes You",      reports:[{ id:"ar-aging"    as Tab, label:"Accounts Receivable Aging",     description:"Outstanding invoices grouped by how long they've been unpaid" }] },
  { category:"Sales & Customers", reports:[{ id:"pl-customer" as Tab, label:"Profit and Loss by Customer",  description:"Revenue, cost, margin and receivables per client" }] },
  { category:"Suppliers & Costs", reports:[{ id:"pl-supplier" as Tab, label:"Profit and Loss by Supplier",  description:"Cost, margin and payables per supplier" }] },
];

const REPORT_LABELS: Record<Tab,string> = { "ar-aging":"Accounts Receivable Aging","pl-monthly":"Profit and Loss by Month","pl-customer":"Profit and Loss by Customer","pl-supplier":"Profit and Loss by Supplier" };

// ─── Main component ───────────────────────────────────────────────────────────

export function FinancialReports({ data }: { data: InvoiceRow[] }) {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialReport = (searchParams?.get("report") as Tab | null) ?? null;
  const [activeReport, setActiveReport] = useState<Tab | null>(initialReport);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [actionsOpen,  setActionsOpen]  = useState(false);
  const [drillDown,  setDrillDown]  = useState<{ rows: InvoiceRow[]; title: string; mode: "ar"|"pl" } | null>(null);
  const [emailState, setEmailState] = useState<{ tab: string; title: string; cols: string[]; dateFrom?: string; dateTo?: string; invoiceNumbers?: string[] } | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const [arVisible,       setArVisible]       = useState(() => new Set(AR_COLS.map(c=>c.key)));
  const [monthlyVisible,  setMonthlyVisible]  = useState(() => new Set(MONTHLY_COLS.map(c=>c.key)));
  const [clientVisible,   setClientVisible]   = useState(() => new Set(CLIENT_COLS.map(c=>c.key)));
  const [supplierVisible, setSupplierVisible] = useState(() => new Set(SUPPLIER_COLS.map(c=>c.key)));

  const colsForReport    = activeReport ? {"ar-aging":AR_COLS,"pl-monthly":MONTHLY_COLS,"pl-customer":CLIENT_COLS,"pl-supplier":SUPPLIER_COLS}[activeReport] : AR_COLS;
  const visibleForReport = activeReport ? {"ar-aging":arVisible,"pl-monthly":monthlyVisible,"pl-customer":clientVisible,"pl-supplier":supplierVisible}[activeReport] : arVisible;
  const setVisibleForReport = activeReport ? {"ar-aging":setArVisible,"pl-monthly":setMonthlyVisible,"pl-customer":setClientVisible,"pl-supplier":setSupplierVisible}[activeReport] : setArVisible;

  function toggleCol(key: string) {
    setVisibleForReport((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function addCondition() {
    setConditions(prev => [...prev, { id: Date.now().toString(), field: "customer", operator: "is not empty", value: "" }]);
  }
  function updateCondition(id: string, k: keyof FilterCondition, v: string) {
    setConditions(prev => prev.map(c => c.id===id ? {...c,[k]:v} : c));
  }
  function removeCondition(id: string) {
    setConditions(prev => prev.filter(c => c.id!==id));
  }

  // Apply all filters
  const dateFiltered = data.filter(r => {
    const d = r.shipmentDate || r.invoiceDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo   && d && d > dateTo)   return false;
    return true;
  });
  const filtered = applyConditions(dateFiltered, conditions);

  const hasFilters = conditions.length > 0 || !!dateFrom || !!dateTo;

  // Download Excel
  async function download() {
    const cols = Array.from(visibleForReport);
    const params = new URLSearchParams({ tab: activeReport!, cols: cols.join(","), dateFrom, dateTo });
    const res = await fetch(`/api/reports/financial?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `BZA_${activeReport}_${new Date().toISOString().split("T")[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    }
  }

  // PDF preview / download — uses a plain GET URL, no blob needed
  function openReportPdf(disposition: "inline" | "attachment") {
    const cols = ["invoiceNumber","clientName","supplierName","product","destination","date","dueDate","days","tons","amount","cost","profit","shipStatus","custPayment"];
    const params = new URLSearchParams({ tab: activeReport!, cols: cols.join(","), dateFrom, dateTo, disposition });
    const url = `/api/reports/financial/pdf?${params}`;
    if (disposition === "inline") {
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `BZA_${activeReport}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
    }
  }

  // ── Browser ────────────────────────────────────────────────────────────────
  if (!activeReport) {
    return (
      <div className="space-y-6">
        {REPORT_CATALOG.map(section => (
          <div key={section.category} className="bg-white rounded-md shadow-sm">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">{section.category}</h2>
            </div>
            <div className="divide-y divide-stone-100">
              {section.reports.map(r => (
                <button key={r.id} onClick={() => { setActiveReport(r.id); setConditions([]); setDateFrom(""); setDateTo(""); }}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-50 text-left group">
                  <div>
                    <p className="text-sm text-[#0d9488] group-hover:underline font-medium">{r.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{r.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-stone-300 group-hover:text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Report view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveReport(null)} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            All Reports
          </button>
          <span className="text-stone-300">/</span>
          <h2 className="text-base font-semibold text-stone-800">{REPORT_LABELS[activeReport]}</h2>
          {filtered.length !== data.length && (
            <span className="text-xs bg-[#0d9488] text-[#0d9488] border border-blue-200 px-2 py-0.5 rounded-full font-medium">{filtered.length} of {data.length} rows</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-stone-500">From</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border border-stone-200 rounded px-2 py-1.5 text-xs bg-white"/>
            <span className="text-stone-500">To</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border border-stone-200 rounded px-2 py-1.5 text-xs bg-white"/>
            {(dateFrom||dateTo) && <button onClick={()=>{setDateFrom("");setDateTo("");}} className="text-stone-400 hover:text-stone-600">✕</button>}
          </div>

          {/* Actions dropdown */}
          <div className="relative" ref={actionsRef}>
            <button onClick={() => setActionsOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs border border-stone-200 bg-white rounded-md px-3 py-1.5 hover:bg-stone-50 text-stone-600 font-medium">
              Action
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-stone-200 rounded-lg shadow-lg z-30 py-1"
                onClick={() => setActionsOpen(false)}>
                <button onClick={() => openReportPdf("inline")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                  <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  Preview PDF
                </button>
                <button onClick={() => openReportPdf("attachment")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                  <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  Download PDF
                </button>
                <button onClick={download}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                  <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Download Excel
                </button>
                <div className="border-t border-stone-100 my-1"/>
                <button onClick={() => setEmailState({ tab: activeReport!, title: REPORT_LABELS[activeReport!], cols: Array.from(visibleForReport), dateFrom, dateTo })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 text-left">
                  <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  Email Report
                </button>
              </div>
            )}
          </div>

          {/* Customize */}
          <button onClick={()=>setCustomizeOpen(true)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium border transition-colors ${hasFilters ? "bg-[#0d9488] text-white border-[#0d9488] hover:bg-[#0d9488]" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            Customize
            {hasFilters && <span className="bg-white text-[#0d9488] rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{conditions.length + (dateFrom?1:0) + (dateTo?1:0)}</span>}
          </button>
        </div>
      </div>

      {/* Report — document-style, wrapped in a thin border */}
      <div className="border border-gray-200 rounded overflow-hidden">
        {activeReport === "ar-aging"    && <ARAgingReport   data={filtered} visible={arVisible}       onDrillDown={(r,t)=>setDrillDown({rows:r,title:t,mode:"ar"})} />}
        {activeReport === "pl-monthly"  && <PLMonthlyReport data={filtered} visible={monthlyVisible}  onDrillDown={(r,t)=>setDrillDown({rows:r,title:t,mode:"pl"})} />}
        {activeReport === "pl-customer" && <PLEntityReport  data={filtered} visible={clientVisible}   isClient={true}  onDrillDown={(r,t)=>setDrillDown({rows:r,title:t,mode:"pl"})} />}
        {activeReport === "pl-supplier" && <PLEntityReport  data={filtered} visible={supplierVisible} isClient={false} onDrillDown={(r,t)=>setDrillDown({rows:r,title:t,mode:"pl"})} />}
      </div>

      {/* Customize panel */}
      <CustomizePanel
        open={customizeOpen} onClose={()=>setCustomizeOpen(false)}
        conditions={conditions} onAdd={addCondition} onUpdate={updateCondition} onRemove={removeCondition} onClear={()=>setConditions([])}
        cols={colsForReport} visible={visibleForReport} onToggleCol={toggleCol}
      />

      {/* Drill-down modal */}
      {drillDown && (
        <DrillDownModal
          title={drillDown.title}
          rows={drillDown.rows}
          mode={drillDown.mode}
          onClose={() => setDrillDown(null)}
          onEmail={() => { setEmailState({ tab: drillDown.mode === "ar" ? "ar-aging" : (activeReport ?? "pl-customer"), title: drillDown.title, cols: Array.from(drillDown.mode === "ar" ? arVisible : visibleForReport), invoiceNumbers: drillDown.rows.map(r => r.invoiceNumber) }); setDrillDown(null); }}
        />
      )}

      {/* Email modal */}
      {emailState && <EmailModal title={emailState.title} tab={emailState.tab} cols={emailState.cols} dateFrom={emailState.dateFrom} dateTo={emailState.dateTo} invoiceNumbers={emailState.invoiceNumbers} onClose={() => setEmailState(null)} />}
    </div>
  );
}
