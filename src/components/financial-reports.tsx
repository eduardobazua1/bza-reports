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

function TH({ visible, children, right }: { visible: boolean; children: React.ReactNode; right?: boolean }) {
  if (!visible) return null;
  return (
    <th className={`px-3 py-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      {children}
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
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const unpaid = data.filter((r) => r.customerPaymentStatus === "unpaid" && r.revenue > 0);

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
              <TH visible={v("client")}>Client</TH>
              <TH visible={v("invoice")}>Invoice #</TH>
              <TH visible={v("po")}>PO #</TH>
              <TH visible={v("product")}>Product</TH>
              <TH visible={v("invoiceDate")}>Invoice Date</TH>
              <TH visible={v("dueDate")}>Due Date</TH>
              <TH visible={v("days")} right>Days Overdue</TH>
              <TH visible={v("amount")} right>Amount</TH>
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
              const days = daysOverdue(r.dueDate);
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

  const map = new Map<string, { invoices: number; tons: number; revenue: number; costNoFreight: number; freight: number; cost: number; profit: number }>();
  data.forEach((r) => {
    const d = r.shipmentDate || r.invoiceDate;
    if (!d) return;
    const key = d.slice(0, 7); // YYYY-MM
    if (!map.has(key)) map.set(key, { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0 });
    const m = map.get(key)!;
    m.invoices += 1; m.tons += r.quantityTons; m.revenue += r.revenue;
    m.costNoFreight += r.costNoFreight; m.freight += r.freight;
    m.cost += r.cost; m.profit += r.profit;
  });

  const months = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, m]) => ({
      key,
      label: new Date(key + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      ...m,
      margin: m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0,
      avgSell: m.tons > 0 ? m.revenue / m.tons : 0,
      avgBuy: m.tons > 0 ? m.costNoFreight / m.tons : 0,
      marginTon: m.tons > 0 ? m.profit / m.tons : 0,
    }));

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
            <TH visible={v("month")}>Month</TH>
            <TH visible={v("invoices")} right>Invoices</TH>
            <TH visible={v("tons")} right>Tons</TH>
            <TH visible={v("revenue")} right>Revenue</TH>
            <TH visible={v("costNoFreight")} right>Cost (ex-freight)</TH>
            <TH visible={v("freight")} right>Freight</TH>
            <TH visible={v("totalCost")} right>Total Cost</TH>
            <TH visible={v("profit")} right>Profit</TH>
            <TH visible={v("margin")} right>Margin %</TH>
            <TH visible={v("avgSell")} right>Avg Sell/TN</TH>
            <TH visible={v("avgBuy")} right>Avg Buy/TN</TH>
            <TH visible={v("marginTon")} right>Margin/TN</TH>
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
            <TH visible={v(nameKey)}>{isClient ? "Client" : "Supplier"}</TH>
            <TH visible={v("invoices")} right>Invoices</TH>
            <TH visible={v("tons")} right>Tons</TH>
            <TH visible={v("revenue")} right>Revenue</TH>
            <TH visible={v("costNoFreight")} right>Cost (ex-freight)</TH>
            <TH visible={v("freight")} right>Freight</TH>
            <TH visible={v("totalCost")} right>Total Cost</TH>
            <TH visible={v("profit")} right>Profit</TH>
            <TH visible={v("margin")} right>Margin %</TH>
            <TH visible={v("avgSell")} right>Avg Sell/TN</TH>
            <TH visible={v("avgBuy")} right>Avg Buy/TN</TH>
            <TH visible={v("marginTon")} right>Margin/TN</TH>
            <TH visible={v("receivable") || v("payable")} right>{isClient ? "Receivable" : "Payable"}</TH>
            <TH visible={v("paidInv")} right>Paid</TH>
            <TH visible={v("unpaidInv")} right>Unpaid</TH>
            <TH visible={v("transport")}>Transport</TH>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={16} className="p-6 text-center text-stone-400 text-sm">No data.</td></tr>
          )}
          {rows.map((r) => (
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

function defaultVisible(cols: { key: string }[]): Set<string> {
  return new Set(cols.map((c) => c.key));
}

export function FinancialReports({ data }: { data: InvoiceRow[] }) {
  const [activeReport, setActiveReport] = useState<Tab | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [arVisible, setArVisible] = useState(() => defaultVisible(AR_COLS));
  const [monthlyVisible, setMonthlyVisible] = useState(() => defaultVisible(MONTHLY_COLS));
  const [clientVisible, setClientVisible] = useState(() => defaultVisible(CLIENT_COLS));
  const [supplierVisible, setSupplierVisible] = useState(() => defaultVisible(SUPPLIER_COLS));

  const filtered = data.filter((r) => {
    const d = r.shipmentDate || r.invoiceDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo && d && d > dateTo) return false;
    return true;
  });

  const colsForReport = activeReport ? {
    "ar-aging": AR_COLS,
    "pl-monthly": MONTHLY_COLS,
    "pl-customer": CLIENT_COLS,
    "pl-supplier": SUPPLIER_COLS,
  }[activeReport] : AR_COLS;

  const visibleForReport = activeReport ? {
    "ar-aging": arVisible,
    "pl-monthly": monthlyVisible,
    "pl-customer": clientVisible,
    "pl-supplier": supplierVisible,
  }[activeReport] : arVisible;

  function toggleCol(key: string) {
    if (!activeReport) return;
    const setters = {
      "ar-aging": setArVisible,
      "pl-monthly": setMonthlyVisible,
      "pl-customer": setClientVisible,
      "pl-supplier": setSupplierVisible,
    };
    setters[activeReport]((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const clientRows = buildEntityRows(filtered, "clientName", "customerPaymentStatus");
  const supplierRows = buildEntityRows(filtered, "supplierName", "supplierPaymentStatus");

  // ── Report browser (QB-style) ──────────────────────────────────────────────
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
                <button
                  key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-50 text-left group"
                >
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
      {/* Back + title */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveReport(null)}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Reports
          </button>
          <span className="text-stone-300">/</span>
          <h2 className="text-base font-semibold text-stone-800">{REPORT_LABELS[activeReport]}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <ActionsDropdown
            cols={colsForReport}
            visible={visibleForReport}
            onToggleCol={toggleCol}
            tab={activeReport}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </div>
      </div>

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
