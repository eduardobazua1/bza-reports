"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

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

// ─── Column definitions ───────────────────────────────────────────────────────

const AR_COLS = [
  { key: "client", label: "Client" },
  { key: "invoice", label: "Invoice #" },
  { key: "po", label: "PO #" },
  { key: "product", label: "Product" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "days", label: "Days Overdue" },
  { key: "amount", label: "Amount" },
  { key: "current", label: "Current" },
  { key: "d30", label: "1–30 days" },
  { key: "d60", label: "31–60 days" },
  { key: "d90", label: "61–90 days" },
  { key: "d90plus", label: "90+ days" },
];

const MONTHLY_COLS = [
  { key: "month", label: "Month" },
  { key: "invoices", label: "Invoices" },
  { key: "tons", label: "Tons" },
  { key: "revenue", label: "Revenue" },
  { key: "costNoFreight", label: "Cost (ex-freight)" },
  { key: "freight", label: "Freight" },
  { key: "totalCost", label: "Total Cost" },
  { key: "profit", label: "Profit" },
  { key: "margin", label: "Margin %" },
  { key: "avgSell", label: "Avg Sell/TN" },
  { key: "avgBuy", label: "Avg Buy/TN" },
  { key: "marginTon", label: "Margin/TN" },
];

const CLIENT_COLS = [
  { key: "client", label: "Client" },
  { key: "invoices", label: "Invoices" },
  { key: "tons", label: "Tons" },
  { key: "revenue", label: "Revenue" },
  { key: "costNoFreight", label: "Cost (ex-freight)" },
  { key: "freight", label: "Freight" },
  { key: "totalCost", label: "Total Cost" },
  { key: "profit", label: "Profit" },
  { key: "margin", label: "Margin %" },
  { key: "avgSell", label: "Avg Sell/TN" },
  { key: "avgBuy", label: "Avg Buy/TN" },
  { key: "marginTon", label: "Margin/TN" },
  { key: "receivable", label: "Receivable" },
  { key: "paidInv", label: "Paid Inv." },
  { key: "unpaidInv", label: "Unpaid Inv." },
  { key: "transport", label: "Transport" },
];

const SUPPLIER_COLS = [
  { key: "supplier", label: "Supplier" },
  { key: "invoices", label: "Invoices" },
  { key: "tons", label: "Tons" },
  { key: "revenue", label: "Revenue" },
  { key: "costNoFreight", label: "Cost (ex-freight)" },
  { key: "freight", label: "Freight" },
  { key: "totalCost", label: "Total Cost" },
  { key: "profit", label: "Profit" },
  { key: "margin", label: "Margin %" },
  { key: "avgBuy", label: "Avg Buy/TN" },
  { key: "marginTon", label: "Margin/TN" },
  { key: "payable", label: "Payable" },
  { key: "paidInv", label: "Paid Inv." },
  { key: "unpaidInv", label: "Unpaid Inv." },
  { key: "transport", label: "Transport" },
];

// ─── Actions dropdown (Columns + Download) ───────────────────────────────────

function ActionsDropdown({
  cols,
  visible,
  onToggleCol,
  tab,
  dateFrom,
  dateTo,
}: {
  cols: { key: string; label: string }[];
  visible: Set<string>;
  onToggleCol: (key: string) => void;
  tab: Tab;
  dateFrom: string;
  dateTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function download() {
    setDownloading(true);
    setOpen(false);
    const params = new URLSearchParams({ tab, cols: Array.from(visible).join(","), dateFrom, dateTo });
    const res = await fetch(`/api/reports/financial?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BZA_${tab}_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setDownloading(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-primary font-medium px-3 py-1.5 border border-stone-200 rounded-md hover:bg-blue-50 bg-white"
      >
        {downloading ? "Generating..." : "Actions"} ▼
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-lg min-w-[200px] py-1">
          {/* Download */}
          <button
            onClick={download}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Excel
          </button>

          {/* Columns section */}
          <div className="border-t border-stone-100 mt-1 pt-1">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide px-4 py-1">Columns</p>
            <div className="px-2 pb-1 max-h-64 overflow-y-auto">
              {cols.map((c) => (
                <label key={c.key} className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-blue-600"
                    checked={visible.has(c.key)}
                    onChange={() => onToggleCol(c.key)}
                  />
                  <span className="text-xs text-stone-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const diff = (Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000;
  return Math.floor(diff);
}

function TH({ visible, children, right, sortKey, sortCol, sortDir, onSort }: {
  visible: boolean; children: React.ReactNode; right?: boolean;
  sortKey?: string; sortCol?: string; sortDir?: "asc" | "desc"; onSort?: (k: string) => void;
}) {
  if (!visible) return null;
  const active = sortKey && sortCol === sortKey;
  return (
    <th
      onClick={sortKey && onSort ? () => onSort(sortKey) : undefined}
      className={`px-3 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap select-none
        ${right ? "text-right" : "text-left"}
        ${sortKey ? "cursor-pointer hover:text-stone-800 hover:bg-stone-100" : ""}
        ${active ? "text-stone-800 bg-stone-100" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey && (
          <span className={`text-[8px] ${active ? "text-blue-600" : "text-stone-300"}`}>
            {active ? (sortDir === "asc" ? "▲" : "▼") : "⬍"}
          </span>
        )}
      </span>
    </th>
  );
}
function TD({ visible, children, right, className }: { visible: boolean; children: React.ReactNode; right?: boolean; className?: string }) {
  if (!visible) return null;
  return (
    <td className={`px-3 py-2 border-t border-stone-100 text-xs ${right ? "text-right" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}

// ─── AR Aging ────────────────────────────────────────────────────────────────

function ARAgingTab({ data, cols, visible }: { data: InvoiceRow[]; cols: typeof AR_COLS; visible: Set<string> }) {
  const v = (k: string) => visible.has(k);
  const [sortCol, setSortCol] = useState("days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortCol === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("desc"); }
  }

  const unpaid = data
    .filter((r) => r.customerPaymentStatus === "unpaid" && r.revenue > 0)
    .map((r) => ({ ...r, _days: daysOverdue(r.dueDate) }))
    .sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0;
      if (sortCol === "client") { va = a.clientName; vb = b.clientName; }
      else if (sortCol === "invoice") { va = a.invoiceNumber; vb = b.invoiceNumber; }
      else if (sortCol === "days") { va = a._days; vb = b._days; }
      else if (sortCol === "amount") { va = a.revenue; vb = b.revenue; }
      else if (sortCol === "dueDate") { va = a.dueDate ?? ""; vb = b.dueDate ?? ""; }
      else if (sortCol === "invoiceDate") { va = a.invoiceDate ?? ""; vb = b.invoiceDate ?? ""; }
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

  // Bucket totals
  let totalCurrent = 0, total30 = 0, total60 = 0, total90 = 0, total90p = 0;
  unpaid.forEach((r) => {
    const days = daysOverdue(r.dueDate);
    if (days <= 0) totalCurrent += r.revenue;
    else if (days <= 30) total30 += r.revenue;
    else if (days <= 60) total60 += r.revenue;
    else if (days <= 90) total90 += r.revenue;
    else total90p += r.revenue;
  });
  const grandTotal = totalCurrent + total30 + total60 + total90 + total90p;

  return (
    <div>
      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "Total Receivable", val: grandTotal, color: "border-l-amber-500" },
          { label: "Current (not due)", val: totalCurrent, color: "border-l-emerald-500" },
          { label: "1–30 days", val: total30, color: "border-l-yellow-400" },
          { label: "31–60 days", val: total60, color: "border-l-orange-400" },
          { label: "61–90+ days", val: total90 + total90p, color: "border-l-red-500" },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-md shadow-sm border-l-[3px] ${s.color} p-3`}>
            <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-sm font-semibold text-stone-900 mt-1">{formatCurrency(s.val)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-md shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <TH visible={v("client")} sortKey="client" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Client</TH>
              <TH visible={v("invoice")} sortKey="invoice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Invoice #</TH>
              <TH visible={v("po")}>PO #</TH>
              <TH visible={v("product")}>Product</TH>
              <TH visible={v("invoiceDate")} sortKey="invoiceDate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Invoice Date</TH>
              <TH visible={v("dueDate")} sortKey="dueDate" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Due Date</TH>
              <TH visible={v("days")} right sortKey="days" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Days Overdue</TH>
              <TH visible={v("amount")} right sortKey="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Amount</TH>
              <TH visible={v("current")} right>Current</TH>
              <TH visible={v("d30")} right>1–30</TH>
              <TH visible={v("d60")} right>31–60</TH>
              <TH visible={v("d90")} right>61–90</TH>
              <TH visible={v("d90plus")} right>90+</TH>
            </tr>
          </thead>
          <tbody>
            {unpaid.length === 0 && (
              <tr><td colSpan={13} className="p-6 text-center text-stone-400 text-sm">No outstanding receivables.</td></tr>
            )}
            {unpaid.map((r, i) => {
              const days = r._days;
              const overdueCls = days > 90 ? "text-red-600 font-bold" : days > 60 ? "text-orange-600 font-semibold" : days > 30 ? "text-yellow-600" : days > 0 ? "text-amber-500" : "text-emerald-600";
              const inCurrent = days <= 0 ? r.revenue : 0;
              const in30 = days > 0 && days <= 30 ? r.revenue : 0;
              const in60 = days > 30 && days <= 60 ? r.revenue : 0;
              const in90 = days > 60 && days <= 90 ? r.revenue : 0;
              const in90p = days > 90 ? r.revenue : 0;
              return (
                <tr key={i} className="hover:bg-stone-50">
                  <TD visible={v("client")} className="font-medium">{r.clientName}</TD>
                  <TD visible={v("invoice")} className="font-mono">{r.invoiceNumber}</TD>
                  <TD visible={v("po")} className="font-mono text-stone-500">{r.poNumber || "—"}</TD>
                  <TD visible={v("product")} className="text-stone-500">{r.product || "—"}</TD>
                  <TD visible={v("invoiceDate")}>{fmtDate(r.invoiceDate)}</TD>
                  <TD visible={v("dueDate")}>{fmtDate(r.dueDate)}</TD>
                  <TD visible={v("days")} right className={overdueCls}>{days <= 0 ? "Not due" : `${days}d`}</TD>
                  <TD visible={v("amount")} right className="font-medium">{formatCurrency(r.revenue)}</TD>
                  <TD visible={v("current")} right className="text-emerald-600">{inCurrent > 0 ? formatCurrency(inCurrent) : "—"}</TD>
                  <TD visible={v("d30")} right className="text-yellow-600">{in30 > 0 ? formatCurrency(in30) : "—"}</TD>
                  <TD visible={v("d60")} right className="text-orange-500">{in60 > 0 ? formatCurrency(in60) : "—"}</TD>
                  <TD visible={v("d90")} right className="text-red-500">{in90 > 0 ? formatCurrency(in90) : "—"}</TD>
                  <TD visible={v("d90plus")} right className="text-red-700 font-bold">{in90p > 0 ? formatCurrency(in90p) : "—"}</TD>
                </tr>
              );
            })}
          </tbody>
          {unpaid.length > 0 && (
            <tfoot className="bg-stone-50 font-semibold text-xs">
              <tr>
                <TD visible={v("client")} className="font-semibold">TOTAL</TD>
                <TD visible={v("invoice")}>{""}</TD>
                <TD visible={v("po")}>{""}</TD>
                <TD visible={v("product")}>{""}</TD>
                <TD visible={v("invoiceDate")}>{""}</TD>
                <TD visible={v("dueDate")}>{""}</TD>
                <TD visible={v("days")}>{""}</TD>
                <TD visible={v("amount")} right className="font-bold">{formatCurrency(grandTotal)}</TD>
                <TD visible={v("current")} right className="text-emerald-600 font-bold">{formatCurrency(totalCurrent)}</TD>
                <TD visible={v("d30")} right className="text-yellow-600 font-bold">{formatCurrency(total30)}</TD>
                <TD visible={v("d60")} right className="text-orange-500 font-bold">{formatCurrency(total60)}</TD>
                <TD visible={v("d90")} right className="text-red-500 font-bold">{formatCurrency(total90)}</TD>
                <TD visible={v("d90plus")} right className="text-red-700 font-bold">{formatCurrency(total90p)}</TD>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── P&L by Month ─────────────────────────────────────────────────────────────

function PLMonthlyTab({ data, visible }: { data: InvoiceRow[]; visible: Set<string> }) {
  const v = (k: string) => visible.has(k);
  const [sortCol, setSortCol] = useState("month");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortCol === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("desc"); }
  }

  const map = new Map<string, { invoices: number; tons: number; revenue: number; costNoFreight: number; freight: number; cost: number; profit: number }>();
  data.forEach((r) => {
    const d = r.shipmentDate || r.invoiceDate;
    if (!d) return;
    const key = d.slice(0, 7);
    if (!map.has(key)) map.set(key, { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0 });
    const m = map.get(key)!;
    m.invoices += 1; m.tons += r.quantityTons; m.revenue += r.revenue;
    m.costNoFreight += r.costNoFreight; m.freight += r.freight;
    m.cost += r.cost; m.profit += r.profit;
  });

  const months = Array.from(map.entries())
    .map(([key, m]) => ({
      key, label: new Date(key + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      ...m,
      margin: m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0,
      avgSell: m.tons > 0 ? m.revenue / m.tons : 0,
      avgBuy: m.tons > 0 ? m.costNoFreight / m.tons : 0,
      marginTon: m.tons > 0 ? m.profit / m.tons : 0,
    }))
    .sort((a, b) => {
      const va = (a as Record<string, string | number>)[sortCol] ?? 0;
      const vb = (b as Record<string, string | number>)[sortCol] ?? 0;
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totals = months.reduce((a, m) => ({
    invoices: a.invoices + m.invoices, tons: a.tons + m.tons,
    revenue: a.revenue + m.revenue, costNoFreight: a.costNoFreight + m.costNoFreight,
    freight: a.freight + m.freight, cost: a.cost + m.cost, profit: a.profit + m.profit,
  }), { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0 });

  return (
    <div className="bg-white rounded-md shadow-sm overflow-x-auto">
      <table className="w-full">
        <thead className="bg-stone-50">
          <tr>
            <TH visible={v("month")} sortKey="key" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Month</TH>
            <TH visible={v("invoices")} right sortKey="invoices" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Invoices</TH>
            <TH visible={v("tons")} right sortKey="tons" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Tons</TH>
            <TH visible={v("revenue")} right sortKey="revenue" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Revenue</TH>
            <TH visible={v("costNoFreight")} right sortKey="costNoFreight" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Cost (ex-freight)</TH>
            <TH visible={v("freight")} right sortKey="freight" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Freight</TH>
            <TH visible={v("totalCost")} right sortKey="cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Total Cost</TH>
            <TH visible={v("profit")} right sortKey="profit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Profit</TH>
            <TH visible={v("margin")} right sortKey="margin" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Margin %</TH>
            <TH visible={v("avgSell")} right sortKey="avgSell" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Avg Sell/TN</TH>
            <TH visible={v("avgBuy")} right sortKey="avgBuy" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Avg Buy/TN</TH>
            <TH visible={v("marginTon")} right sortKey="marginTon" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Margin/TN</TH>
          </tr>
        </thead>
        <tbody>
          {months.length === 0 && (
            <tr><td colSpan={12} className="p-6 text-center text-stone-400 text-sm">No data.</td></tr>
          )}
          {months.map((m) => (
            <tr key={m.key} className="hover:bg-stone-50">
              <TD visible={v("month")} className="font-medium">{m.label}</TD>
              <TD visible={v("invoices")} right>{m.invoices}</TD>
              <TD visible={v("tons")} right>{formatNumber(m.tons, 1)}</TD>
              <TD visible={v("revenue")} right>{formatCurrency(m.revenue)}</TD>
              <TD visible={v("costNoFreight")} right>{formatCurrency(m.costNoFreight)}</TD>
              <TD visible={v("freight")} right>{formatCurrency(m.freight)}</TD>
              <TD visible={v("totalCost")} right>{formatCurrency(m.cost)}</TD>
              <TD visible={v("profit")} right className={m.profit >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{formatCurrency(m.profit)}</TD>
              <TD visible={v("margin")} right className={m.margin >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPercent(m.margin)}</TD>
              <TD visible={v("avgSell")} right>{formatCurrency(m.avgSell)}</TD>
              <TD visible={v("avgBuy")} right>{formatCurrency(m.avgBuy)}</TD>
              <TD visible={v("marginTon")} right className={m.marginTon >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(m.marginTon)}</TD>
            </tr>
          ))}
        </tbody>
        {months.length > 0 && (
          <tfoot className="bg-stone-50">
            <tr>
              <TD visible={v("month")} className="font-semibold">TOTAL</TD>
              <TD visible={v("invoices")} right className="font-semibold">{totals.invoices}</TD>
              <TD visible={v("tons")} right className="font-semibold">{formatNumber(totals.tons, 1)}</TD>
              <TD visible={v("revenue")} right className="font-semibold">{formatCurrency(totals.revenue)}</TD>
              <TD visible={v("costNoFreight")} right className="font-semibold">{formatCurrency(totals.costNoFreight)}</TD>
              <TD visible={v("freight")} right className="font-semibold">{formatCurrency(totals.freight)}</TD>
              <TD visible={v("totalCost")} right className="font-semibold">{formatCurrency(totals.cost)}</TD>
              <TD visible={v("profit")} right className={`font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(totals.profit)}</TD>
              <TD visible={v("margin")} right className={`font-semibold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPercent(totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0)}</TD>
              <TD visible={v("avgSell")} right className="font-semibold">{formatCurrency(totals.tons > 0 ? totals.revenue / totals.tons : 0)}</TD>
              <TD visible={v("avgBuy")} right className="font-semibold">{formatCurrency(totals.tons > 0 ? totals.costNoFreight / totals.tons : 0)}</TD>
              <TD visible={v("marginTon")} right className={`font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(totals.tons > 0 ? totals.profit / totals.tons : 0)}</TD>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── P&L by Entity (shared for client + supplier) ────────────────────────────

type EntityRow = {
  name: string;
  invoices: number;
  tons: number;
  revenue: number;
  costNoFreight: number;
  freight: number;
  cost: number;
  profit: number;
  margin: number;
  avgSell: number;
  avgBuy: number;
  marginTon: number;
  receivable: number;
  paidInv: number;
  unpaidInv: number;
  transport: Map<string, number>;
};

function buildEntityRows(data: InvoiceRow[], nameKey: "clientName" | "supplierName", payKey: "customerPaymentStatus" | "supplierPaymentStatus"): EntityRow[] {
  const map = new Map<string, EntityRow>();
  data.forEach((r) => {
    const name = r[nameKey];
    if (!map.has(name)) map.set(name, {
      name, invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0,
      profit: 0, margin: 0, avgSell: 0, avgBuy: 0, marginTon: 0,
      receivable: 0, paidInv: 0, unpaidInv: 0, transport: new Map(),
    });
    const e = map.get(name)!;
    e.invoices += 1; e.tons += r.quantityTons;
    e.revenue += r.revenue; e.costNoFreight += r.costNoFreight;
    e.freight += r.freight; e.cost += r.cost; e.profit += r.profit;
    if (r[payKey] === "paid") e.paidInv += 1;
    else { e.unpaidInv += 1; e.receivable += r.revenue; }
    e.transport.set(r.transportType, (e.transport.get(r.transportType) || 0) + r.quantityTons);
  });
  return Array.from(map.values()).map((e) => ({
    ...e,
    margin: e.revenue > 0 ? (e.profit / e.revenue) * 100 : 0,
    avgSell: e.tons > 0 ? e.revenue / e.tons : 0,
    avgBuy: e.tons > 0 ? e.costNoFreight / e.tons : 0,
    marginTon: e.tons > 0 ? e.profit / e.tons : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

function PLEntityTab({
  rows,
  isClient,
  colDefs,
  visible,
}: {
  rows: EntityRow[];
  isClient: boolean;
  colDefs: { key: string; label: string }[];
  visible: Set<string>;
}) {
  const v = (k: string) => visible.has(k);
  const nameKey = isClient ? "client" : "supplier";
  const [sortCol, setSortCol] = useState("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortCol === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(key); setSortDir("desc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    let va: string | number = 0, vb: string | number = 0;
    if (sortCol === "name") { va = a.name; vb = b.name; }
    else { va = (a as Record<string, number>)[sortCol] ?? 0; vb = (b as Record<string, number>)[sortCol] ?? 0; }
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totals = rows.reduce((a, r) => ({
    invoices: a.invoices + r.invoices, tons: a.tons + r.tons,
    revenue: a.revenue + r.revenue, costNoFreight: a.costNoFreight + r.costNoFreight,
    freight: a.freight + r.freight, cost: a.cost + r.cost, profit: a.profit + r.profit,
    receivable: a.receivable + r.receivable, paidInv: a.paidInv + r.paidInv, unpaidInv: a.unpaidInv + r.unpaidInv,
  }), { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0, receivable: 0, paidInv: 0, unpaidInv: 0 });

  const transportColors: Record<string, string> = {
    Railroad: "bg-blue-100 text-blue-700",
    Maritime: "bg-emerald-100 text-emerald-700",
    Truck: "bg-amber-100 text-amber-700",
    Other: "bg-stone-100 text-stone-600",
  };

  return (
    <div className="bg-white rounded-md shadow-sm overflow-x-auto">
      <table className="w-full">
        <thead className="bg-stone-50">
          <tr>
            <TH visible={v(nameKey)} sortKey="name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{isClient ? "Client" : "Supplier"}</TH>
            <TH visible={v("invoices")} right sortKey="invoices" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Invoices</TH>
            <TH visible={v("tons")} right sortKey="tons" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Tons</TH>
            <TH visible={v("revenue")} right sortKey="revenue" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Revenue</TH>
            <TH visible={v("costNoFreight")} right sortKey="costNoFreight" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Cost (ex-freight)</TH>
            <TH visible={v("freight")} right sortKey="freight" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Freight</TH>
            <TH visible={v("totalCost")} right sortKey="cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Total Cost</TH>
            <TH visible={v("profit")} right sortKey="profit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Profit</TH>
            <TH visible={v("margin")} right sortKey="margin" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Margin %</TH>
            <TH visible={v("avgSell")} right sortKey="avgSell" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Avg Sell/TN</TH>
            <TH visible={v("avgBuy")} right sortKey="avgBuy" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Avg Buy/TN</TH>
            <TH visible={v("marginTon")} right sortKey="marginTon" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Margin/TN</TH>
            <TH visible={v("receivable") || v("payable")} right sortKey="receivable" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>{isClient ? "Receivable" : "Payable"}</TH>
            <TH visible={v("paidInv")} right sortKey="paidInv" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Paid</TH>
            <TH visible={v("unpaidInv")} right sortKey="unpaidInv" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>Unpaid</TH>
            <TH visible={v("transport")}>Transport</TH>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={16} className="p-6 text-center text-stone-400 text-sm">No data.</td></tr>
          )}
          {sorted.map((r) => (
            <tr key={r.name} className="hover:bg-stone-50 align-middle">
              <TD visible={v(nameKey)} className="font-semibold">{r.name}</TD>
              <TD visible={v("invoices")} right>{r.invoices}</TD>
              <TD visible={v("tons")} right>{formatNumber(r.tons, 1)}</TD>
              <TD visible={v("revenue")} right>{formatCurrency(r.revenue)}</TD>
              <TD visible={v("costNoFreight")} right>{formatCurrency(r.costNoFreight)}</TD>
              <TD visible={v("freight")} right>{formatCurrency(r.freight)}</TD>
              <TD visible={v("totalCost")} right>{formatCurrency(r.cost)}</TD>
              <TD visible={v("profit")} right className={r.profit >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{formatCurrency(r.profit)}</TD>
              <TD visible={v("margin")} right className={r.margin >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPercent(r.margin)}</TD>
              <TD visible={v("avgSell")} right>{formatCurrency(r.avgSell)}</TD>
              <TD visible={v("avgBuy")} right>{formatCurrency(r.avgBuy)}</TD>
              <TD visible={v("marginTon")} right className={r.marginTon >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{formatCurrency(r.marginTon)}</TD>
              <TD visible={v("receivable") || v("payable")} right className="text-amber-600 font-medium">{r.receivable > 0 ? formatCurrency(r.receivable) : "—"}</TD>
              <TD visible={v("paidInv")} right className="text-emerald-600">{r.paidInv}</TD>
              <TD visible={v("unpaidInv")} right className={r.unpaidInv > 0 ? "text-amber-600 font-medium" : "text-stone-400"}>{r.unpaidInv}</TD>
              <TD visible={v("transport")}>
                <div className="flex flex-wrap gap-1">
                  {Array.from(r.transport.entries()).sort((a, b) => b[1] - a[1]).map(([t, tons]) => (
                    <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${transportColors[t] ?? "bg-stone-100 text-stone-600"}`}>
                      {t} {formatNumber((tons / r.tons) * 100, 0)}%
                    </span>
                  ))}
                </div>
              </TD>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-stone-50">
            <tr>
              <TD visible={v(nameKey)} className="font-semibold">TOTAL</TD>
              <TD visible={v("invoices")} right className="font-semibold">{totals.invoices}</TD>
              <TD visible={v("tons")} right className="font-semibold">{formatNumber(totals.tons, 1)}</TD>
              <TD visible={v("revenue")} right className="font-semibold">{formatCurrency(totals.revenue)}</TD>
              <TD visible={v("costNoFreight")} right className="font-semibold">{formatCurrency(totals.costNoFreight)}</TD>
              <TD visible={v("freight")} right className="font-semibold">{formatCurrency(totals.freight)}</TD>
              <TD visible={v("totalCost")} right className="font-semibold">{formatCurrency(totals.cost)}</TD>
              <TD visible={v("profit")} right className={`font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(totals.profit)}</TD>
              <TD visible={v("margin")} right className={`font-semibold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPercent(totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0)}</TD>
              <TD visible={v("avgSell")} right className="font-semibold">{formatCurrency(totals.tons > 0 ? totals.revenue / totals.tons : 0)}</TD>
              <TD visible={v("avgBuy")} right className="font-semibold">{formatCurrency(totals.tons > 0 ? totals.costNoFreight / totals.tons : 0)}</TD>
              <TD visible={v("marginTon")} right className={`font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(totals.tons > 0 ? totals.profit / totals.tons : 0)}</TD>
              <TD visible={v("receivable") || v("payable")} right className="text-amber-600 font-bold">{formatCurrency(totals.receivable)}</TD>
              <TD visible={v("paidInv")} right className="text-emerald-600 font-semibold">{totals.paidInv}</TD>
              <TD visible={v("unpaidInv")} right className="text-amber-600 font-semibold">{totals.unpaidInv}</TD>
              <TD visible={v("transport")}>{""}</TD>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Report catalog ──────────────────────────────────────────────────────────

const REPORT_CATALOG = [
  {
    category: "Business Overview",
    reports: [
      { id: "pl-monthly" as Tab, label: "Profit and Loss by Month", description: "Revenue, cost and profit broken down by calendar month" },
    ],
  },
  {
    category: "Who Owes You",
    reports: [
      { id: "ar-aging" as Tab, label: "Accounts Receivable Aging", description: "Outstanding invoices grouped by how long they've been unpaid" },
    ],
  },
  {
    category: "Sales & Customers",
    reports: [
      { id: "pl-customer" as Tab, label: "Profit and Loss by Customer", description: "Revenue, cost, margin and receivables per client" },
    ],
  },
  {
    category: "Suppliers & Costs",
    reports: [
      { id: "pl-supplier" as Tab, label: "Profit and Loss by Supplier", description: "Cost, margin and payables per supplier" },
    ],
  },
];

const REPORT_LABELS: Record<Tab, string> = {
  "ar-aging": "Accounts Receivable Aging",
  "pl-monthly": "Profit and Loss by Month",
  "pl-customer": "Profit and Loss by Customer",
  "pl-supplier": "Profit and Loss by Supplier",
};

const REPORT_DESCRIPTIONS: Record<Tab, string> = {
  "ar-aging": "Outstanding invoices grouped by aging bucket",
  "pl-monthly": "Revenue, cost and profit by calendar month",
  "pl-customer": "Revenue, cost, margin and receivables per client",
  "pl-supplier": "Cost, margin and payables per supplier",
};

// ─── Filter panel ─────────────────────────────────────────────────────────────

type Filters = {
  clients: Set<string>;
  suppliers: Set<string>;
  products: Set<string>;
  destinations: Set<string>;
  transports: Set<string>;
  shipmentStatuses: Set<string>;
  customerPayment: Set<string>;
  supplierPayment: Set<string>;
};

function emptyFilters(): Filters {
  return {
    clients: new Set(), suppliers: new Set(), products: new Set(),
    destinations: new Set(), transports: new Set(),
    shipmentStatuses: new Set(), customerPayment: new Set(), supplierPayment: new Set(),
  };
}

function hasActiveFilters(f: Filters) {
  return Object.values(f).some((s) => s.size > 0);
}

function FilterSection({
  label, options, selected, onToggle,
}: { label: string; options: string[]; selected: Set<string>; onToggle: (v: string) => void }) {
  if (options.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="space-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 px-1 py-0.5 rounded">
            <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600"
              checked={selected.has(o)} onChange={() => onToggle(o)} />
            <span className="text-xs text-stone-700">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FiltersPanel({
  data, filters, onChange, onClear, open, onClose,
}: {
  data: InvoiceRow[];
  filters: Filters;
  onChange: (key: keyof Filters, val: string) => void;
  onClear: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const uniq = (fn: (r: InvoiceRow) => string | null | undefined) =>
    [...new Set(data.map(fn).filter(Boolean) as string[])].sort();

  const shipLabels: Record<string, string> = {
    programado: "Scheduled", en_transito: "In Transit", en_aduana: "In Customs", entregado: "Delivered",
  };

  if (!open) return null;

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-xl w-72 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 sticky top-0 bg-white">
        <p className="text-sm font-semibold text-stone-800">Filters</p>
        <div className="flex items-center gap-2">
          {hasActiveFilters(filters) && (
            <button onClick={onClear} className="text-xs text-blue-600 hover:underline">Clear all</button>
          )}
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-lg leading-none">×</button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <FilterSection label="Client" options={uniq((r) => r.clientName)}
          selected={filters.clients} onToggle={(v) => onChange("clients", v)} />
        <FilterSection label="Supplier" options={uniq((r) => r.supplierName)}
          selected={filters.suppliers} onToggle={(v) => onChange("suppliers", v)} />
        <FilterSection label="Product" options={uniq((r) => r.product)}
          selected={filters.products} onToggle={(v) => onChange("products", v)} />
        <FilterSection label="Destination" options={uniq((r) => r.destination)}
          selected={filters.destinations} onToggle={(v) => onChange("destinations", v)} />
        <FilterSection label="Transport" options={uniq((r) => r.transportType)}
          selected={filters.transports} onToggle={(v) => onChange("transports", v)} />
        <FilterSection
          label="Shipment Status"
          options={uniq((r) => r.shipmentStatus).map((s) => shipLabels[s] ?? s)}
          selected={new Set([...filters.shipmentStatuses].map((s) => shipLabels[s] ?? s))}
          onToggle={(v) => {
            const raw = Object.entries(shipLabels).find(([, lbl]) => lbl === v)?.[0] ?? v;
            onChange("shipmentStatuses", raw);
          }}
        />
        <FilterSection label="Customer Payment"
          options={["Paid", "Unpaid"]}
          selected={new Set([...filters.customerPayment].map((s) => s === "paid" ? "Paid" : "Unpaid"))}
          onToggle={(v) => onChange("customerPayment", v === "Paid" ? "paid" : "unpaid")} />
        <FilterSection label="Supplier Payment"
          options={["Paid", "Unpaid"]}
          selected={new Set([...filters.supplierPayment].map((s) => s === "paid" ? "Paid" : "Unpaid"))}
          onToggle={(v) => onChange("supplierPayment", v === "Paid" ? "paid" : "unpaid")} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function defaultVisible(cols: { key: string }[]): Set<string> {
  return new Set(cols.map((c) => c.key));
}

export function FinancialReports({ data }: { data: InvoiceRow[] }) {
  const [activeReport, setActiveReport] = useState<Tab | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [arVisible, setArVisible] = useState(() => defaultVisible(AR_COLS));
  const [monthlyVisible, setMonthlyVisible] = useState(() => defaultVisible(MONTHLY_COLS));
  const [clientVisible, setClientVisible] = useState(() => defaultVisible(CLIENT_COLS));
  const [supplierVisible, setSupplierVisible] = useState(() => defaultVisible(SUPPLIER_COLS));

  function toggleFilter(key: keyof Filters, val: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(val)) next.delete(val); else next.add(val);
      return { ...prev, [key]: next };
    });
  }

  // Apply all filters
  const filtered = data.filter((r) => {
    const d = r.shipmentDate || r.invoiceDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo && d && d > dateTo) return false;
    if (filters.clients.size > 0 && !filters.clients.has(r.clientName)) return false;
    if (filters.suppliers.size > 0 && !filters.suppliers.has(r.supplierName)) return false;
    if (filters.products.size > 0 && !filters.products.has(r.product ?? "")) return false;
    if (filters.destinations.size > 0 && !filters.destinations.has(r.destination ?? "")) return false;
    if (filters.transports.size > 0 && !filters.transports.has(r.transportType)) return false;
    if (filters.shipmentStatuses.size > 0 && !filters.shipmentStatuses.has(r.shipmentStatus)) return false;
    if (filters.customerPayment.size > 0 && !filters.customerPayment.has(r.customerPaymentStatus)) return false;
    if (filters.supplierPayment.size > 0 && !filters.supplierPayment.has(r.supplierPaymentStatus)) return false;
    return true;
  });

  const colsForReport = activeReport ? {
    "ar-aging": AR_COLS, "pl-monthly": MONTHLY_COLS,
    "pl-customer": CLIENT_COLS, "pl-supplier": SUPPLIER_COLS,
  }[activeReport] : AR_COLS;

  const visibleForReport = activeReport ? {
    "ar-aging": arVisible, "pl-monthly": monthlyVisible,
    "pl-customer": clientVisible, "pl-supplier": supplierVisible,
  }[activeReport] : arVisible;

  function toggleCol(key: string) {
    if (!activeReport) return;
    const setters = {
      "ar-aging": setArVisible, "pl-monthly": setMonthlyVisible,
      "pl-customer": setClientVisible, "pl-supplier": setSupplierVisible,
    };
    setters[activeReport]((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const clientRows = buildEntityRows(filtered, "clientName", "customerPaymentStatus");
  const supplierRows = buildEntityRows(filtered, "supplierName", "supplierPaymentStatus");

  // Active filter chips
  const activeChips: { label: string; key: keyof Filters; val: string }[] = [];
  const shipLabels: Record<string, string> = { programado: "Scheduled", en_transito: "In Transit", en_aduana: "In Customs", entregado: "Delivered" };
  const chipLabels: Record<keyof Filters, string> = {
    clients: "Client", suppliers: "Supplier", products: "Product", destinations: "Destination",
    transports: "Transport", shipmentStatuses: "Status", customerPayment: "Cust. Payment", supplierPayment: "Supp. Payment",
  };
  (Object.entries(filters) as [keyof Filters, Set<string>][]).forEach(([key, set]) => {
    set.forEach((val) => {
      const display = key === "shipmentStatuses" ? (shipLabels[val] ?? val) : key === "customerPayment" || key === "supplierPayment" ? (val === "paid" ? "Paid" : "Unpaid") : val;
      activeChips.push({ label: `${chipLabels[key]}: ${display}`, key, val });
    });
  });

  // ── Report browser ─────────────────────────────────────────────────────────
  if (!activeReport) {
    return (
      <div className="space-y-6">
        {REPORT_CATALOG.map((section) => (
          <div key={section.category} className="bg-white rounded-md shadow-sm">
            <div className="px-5 py-3 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">{section.category}</h2>
            </div>
            <div className="divide-y divide-stone-100">
              {section.reports.map((r) => (
                <button key={r.id} onClick={() => setActiveReport(r.id)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-50 text-left group">
                  <div>
                    <p className="text-sm text-blue-600 group-hover:underline font-medium">{r.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{r.description}</p>
                  </div>
                  <svg className="w-4 h-4 text-stone-300 group-hover:text-stone-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Active report view ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveReport(null)}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Reports
          </button>
          <span className="text-stone-300">/</span>
          <h2 className="text-base font-semibold text-stone-800">{REPORT_LABELS[activeReport]}</h2>
          {filtered.length !== data.length && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {filtered.length} of {data.length} rows
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-stone-500">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-stone-200 rounded px-2 py-1.5 text-xs bg-white" />
            <span className="text-stone-500">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-stone-200 rounded px-2 py-1.5 text-xs bg-white" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-stone-400 hover:text-stone-600">✕</button>
            )}
          </div>

          {/* Filters button */}
          <div className="relative">
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-md font-medium transition-colors ${
                hasActiveFilters(filters)
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {hasActiveFilters(filters) && (
                <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {activeChips.length}
                </span>
              )}
            </button>
            <FiltersPanel
              data={data}
              filters={filters}
              onChange={toggleFilter}
              onClear={() => setFilters(emptyFilters())}
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
            />
          </div>

          <ActionsDropdown cols={colsForReport} visible={visibleForReport}
            onToggleCol={toggleCol} tab={activeReport} dateFrom={dateFrom} dateTo={dateTo} />
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full">
              {chip.label}
              <button onClick={() => toggleFilter(chip.key, chip.val)} className="hover:text-blue-900 font-bold leading-none">×</button>
            </span>
          ))}
          <button onClick={() => setFilters(emptyFilters())} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1">
            Clear all
          </button>
        </div>
      )}

      {/* Report */}
      {activeReport === "ar-aging" && <ARAgingTab data={filtered} cols={AR_COLS} visible={arVisible} />}
      {activeReport === "pl-monthly" && <PLMonthlyTab data={filtered} visible={monthlyVisible} />}
      {activeReport === "pl-customer" && (
        <PLEntityTab rows={clientRows} isClient={true} colDefs={CLIENT_COLS} visible={clientVisible} />
      )}
      {activeReport === "pl-supplier" && (
        <PLEntityTab rows={supplierRows} isClient={false} colDefs={SUPPLIER_COLS} visible={supplierVisible} />
      )}
    </div>
  );
}
