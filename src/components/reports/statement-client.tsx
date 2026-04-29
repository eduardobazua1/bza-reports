"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Download, Mail, X, Check, Settings2, ChevronDown } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type StatementInvoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  shipmentDate: string | null;
  dueDate: string | null;
  quantityTons: number;
  customerPaymentStatus: string | null;
  sellPrice: number;
  poNumber: string | null;
};

type StatementPayment = {
  id: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string | null;
};

type StatementCredit = {
  id: number;
  memoDate: string;
  amount: number;
  creditNumber: string | null;
  reason: string | null;
  status: string;
};

type StatementData = {
  invoices: StatementInvoice[];
  payments: StatementPayment[];
  credits: StatementCredit[];
};

type ClientOption = { id: number; name: string };

type ToastState = { message: string; type: "success" | "error" } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  wire_transfer:    "Wire Transfer",
  cv_credit:        "CV Credit",
  xepellin:         "Xepellin",
  factoraje_bbva:   "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other:            "Other",
};

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

// ─── Statement View (print-ready) ─────────────────────────────────────────────
function StatementView({
  clientName,
  statement,
  asOf,
  fromDate,
  toDate,
}: {
  clientName: string;
  statement: StatementData;
  asOf: string;
  fromDate?: string;
  toDate?: string;
}) {
  // Build unified transaction timeline
  type Tx = {
    date: string;
    type: "Invoice" | "Payment" | "Credit";
    ref: string;
    description: string;
    amount: number;   // positive = charge, negative = credit/payment
    balance: number;
    status?: string;
  };

  const transactions: Tx[] = [];

  for (const inv of statement.invoices) {
    const date = inv.invoiceDate ?? inv.shipmentDate ?? "";
    if (fromDate && date < fromDate) continue;
    if (toDate && date > toDate) continue;
    transactions.push({
      date,
      type: "Invoice",
      ref: inv.invoiceNumber,
      description: `Invoice ${inv.invoiceNumber}${inv.poNumber ? ` · PO ${inv.poNumber}` : ""}`,
      amount: inv.quantityTons * inv.sellPrice,
      balance: 0,
      status: inv.customerPaymentStatus ?? undefined,
    });
  }

  for (const p of statement.payments) {
    if (fromDate && p.paymentDate < fromDate) continue;
    if (toDate && p.paymentDate > toDate) continue;
    transactions.push({
      date: p.paymentDate,
      type: "Payment",
      ref: p.referenceNo ?? String(p.id),
      description: `Payment — ${METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}${p.referenceNo ? ` · Ref ${p.referenceNo}` : ""}`,
      amount: -p.amount,
      balance: 0,
    });
  }

  for (const c of statement.credits) {
    if (c.status === "void") continue;
    if (fromDate && c.memoDate < fromDate) continue;
    if (toDate && c.memoDate > toDate) continue;
    transactions.push({
      date: c.memoDate,
      type: "Credit",
      ref: c.creditNumber ?? String(c.id),
      description: `Credit Memo${c.creditNumber ? ` ${c.creditNumber}` : ""}${c.reason ? ` — ${c.reason}` : ""}`,
      amount: -c.amount,
      balance: 0,
    });
  }

  // Sort by date asc, then compute running balance
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  for (const tx of transactions) {
    running += tx.amount;
    tx.balance = running;
  }

  const totalCharges  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalCredits  = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const balanceDue    = running;

  const dateRange = fromDate && toDate
    ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
    : fromDate ? `From ${formatDate(fromDate)}`
    : toDate ? `Through ${formatDate(toDate)}`
    : "All Dates";

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
      {/* Statement header */}
      <div className="py-6 px-8 text-center border-b border-stone-100">
        <h2 className="text-lg font-bold text-stone-800">Statement of Account</h2>
        <p className="text-sm text-stone-500 mt-0.5">BZA International Services</p>
        <p className="text-sm font-semibold text-stone-700 mt-2">{clientName}</p>
        <p className="text-sm text-stone-400 mt-0.5">{dateRange}</p>
        <p className="text-xs text-stone-400 mt-0.5">As of {asOf}</p>
      </div>

      {/* Summary pills */}
      <div className="flex justify-center gap-6 py-4 border-b border-stone-100 bg-stone-50 print:bg-white">
        <div className="text-center">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Charges</p>
          <p className="text-base font-bold text-stone-800 mt-0.5">{formatCurrency(totalCharges)}</p>
        </div>
        <div className="w-px bg-stone-200" />
        <div className="text-center">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Credits & Payments</p>
          <p className="text-base font-bold text-teal-700 mt-0.5">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="w-px bg-stone-200" />
        <div className="text-center">
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Balance Due</p>
          <p className={`text-base font-bold mt-0.5 ${balanceDue > 0 ? "text-red-600" : "text-stone-800"}`}>
            {formatCurrency(Math.abs(balanceDue))}
            {balanceDue < 0 && <span className="text-xs font-normal ml-1">(credit)</span>}
          </p>
        </div>
      </div>

      {/* Transactions table */}
      {transactions.length === 0 ? (
        <div className="py-16 text-center text-stone-400 text-sm">No transactions in this period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 print:bg-white">
                <th className="text-left px-6 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Description</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Charges</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Credits</th>
                <th className="text-right px-6 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={i} className="border-b border-stone-50 hover:bg-stone-50 print:hover:bg-white">
                  <td className="px-6 py-2.5 text-stone-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${
                      tx.type === "Invoice" ? "bg-blue-50 text-blue-700 ring-blue-200"
                      : tx.type === "Payment" ? "bg-teal-50 text-teal-700 ring-teal-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-700 max-w-xs">{tx.description}</td>
                  <td className="px-4 py-2.5 text-right text-stone-800">
                    {tx.amount > 0 ? formatCurrency(tx.amount) : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right text-teal-700">
                    {tx.amount < 0 ? formatCurrency(Math.abs(tx.amount)) : ""}
                  </td>
                  <td className={`px-6 py-2.5 text-right font-semibold ${tx.balance > 0 ? "text-stone-800" : tx.balance < 0 ? "text-teal-700" : "text-stone-400"}`}>
                    {formatCurrency(Math.abs(tx.balance))}
                    {tx.balance < 0 && <span className="text-xs font-normal ml-0.5">CR</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50 print:bg-white">
                <td colSpan={3} className="px-6 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide">Balance Due</td>
                <td className="px-4 py-3 text-right font-bold text-stone-800">{formatCurrency(totalCharges)}</td>
                <td className="px-4 py-3 text-right font-bold text-teal-700">{formatCurrency(totalCredits)}</td>
                <td className={`px-6 py-3 text-right text-base font-bold ${balanceDue > 0 ? "text-red-600" : "text-teal-700"}`}>
                  {formatCurrency(Math.abs(balanceDue))}
                  {balanceDue < 0 && <span className="text-xs font-normal ml-1">CR</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer note */}
      <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
        Generated {new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────
export function StatementClient({
  clients,
  initialClientId,
  initialFrom,
  initialTo,
  statement,
}: {
  clients: ClientOption[];
  initialClientId: number | null;
  initialFrom: string;
  initialTo: string;
  statement: StatementData | null;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>(initialClientId ? String(initialClientId) : "");
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);

  const [showEmail, setShowEmail] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isPdfPending, startPdf] = useTransition();
  const [isEmailPending, startEmail] = useTransition();
  const downloadRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find(c => c.id === Number(clientId));

  function apply() {
    if (!clientId) return;
    const params = new URLSearchParams({ client: clientId });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    router.push(`/reports/statements?${params.toString()}`);
  }

  const asOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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

  // ── Build timeline for export ─────────────────────────────────────────────
  function buildTimeline() {
    if (!statement) return [];
    type Tx = { date: string; type: string; description: string; amount: number; balance: number };
    const transactions: Tx[] = [];

    for (const inv of statement.invoices) {
      const date = inv.invoiceDate ?? inv.shipmentDate ?? "";
      if (fromDate && date < fromDate) continue;
      if (toDate && date > toDate) continue;
      transactions.push({
        date,
        type: "Invoice",
        description: `Invoice ${inv.invoiceNumber}${inv.poNumber ? ` · PO ${inv.poNumber}` : ""}`,
        amount: inv.quantityTons * inv.sellPrice,
        balance: 0,
      });
    }

    for (const p of statement.payments) {
      if (fromDate && p.paymentDate < fromDate) continue;
      if (toDate && p.paymentDate > toDate) continue;
      transactions.push({
        date: p.paymentDate,
        type: "Payment",
        description: `Payment — ${METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}${p.referenceNo ? ` · Ref ${p.referenceNo}` : ""}`,
        amount: -p.amount,
        balance: 0,
      });
    }

    for (const c of statement.credits) {
      if (c.status === "void") continue;
      if (fromDate && c.memoDate < fromDate) continue;
      if (toDate && c.memoDate > toDate) continue;
      transactions.push({
        date: c.memoDate,
        type: "Credit",
        description: `Credit Memo${c.creditNumber ? ` ${c.creditNumber}` : ""}${c.reason ? ` — ${c.reason}` : ""}`,
        amount: -c.amount,
        balance: 0,
      });
    }

    transactions.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    for (const tx of transactions) {
      running += tx.amount;
      tx.balance = running;
    }
    return transactions;
  }

  // ── Build PDF payload ─────────────────────────────────────────────────────
  function buildPayload() {
    const timeline = buildTimeline();
    const exportHeaders = ["Date", "Type", "Description", "Amount", "Balance"];
    const pdfRows = timeline.map((tx, i) => ({
      "0": formatDate(tx.date),
      "1": tx.type,
      "2": tx.description,
      "3": tx.amount,
      "4": tx.balance,
    }));
    return {
      title: "Statement of Account",
      subtitle: selectedClient ? `${selectedClient.name} — BZA International Services` : "BZA International Services",
      dateLabel: `As of ${asOf}`,
      columns: exportHeaders.map((h, i) => ({
        key: String(i),
        label: h,
        align: (i === 0 || i === 1 || i === 2 ? "left" : "right") as "left" | "right",
        ...(i >= 3 ? { format: "currency" as const } : {}),
      })),
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
      const clientSlug = selectedClient?.name.replace(/\s+/g, "-") ?? "Statement";
      const a = document.createElement("a"); a.href = url; a.download = `Statement-${clientSlug}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  }

  // ── Excel ─────────────────────────────────────────────────────────────────
  function handleExcel() {
    setShowDownload(false);
    const timeline = buildTimeline();
    const headers = ["Date", "Type", "Description", "Amount", "Balance"];
    const dataRows = timeline.map(tx => [
      formatDate(tx.date), tx.type, tx.description, tx.amount, tx.balance,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 50 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    const clientSlug = selectedClient?.name.replace(/\s+/g, "-") ?? "Statement";
    XLSX.writeFile(wb, `Statement-${clientSlug}.xlsx`);
  }

  // ── CSV ───────────────────────────────────────────────────────────────────
  function handleCsv() {
    setShowDownload(false);
    const timeline = buildTimeline();
    const headers = ["Date", "Type", "Description", "Amount", "Balance"];
    const dataRows = timeline.map(tx => [
      formatDate(tx.date), tx.type, tx.description, tx.amount, tx.balance,
    ]);
    const csv = [headers, ...dataRows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const clientSlug = selectedClient?.name.replace(/\s+/g, "-") ?? "Statement";
    const a = document.createElement("a"); a.href = url; a.download = `Statement-${clientSlug}.csv`;
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

  const emailSubject = selectedClient
    ? `Statement of Account — ${selectedClient.name}`
    : "Statement of Account — BZA International Services";

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
          <p className="text-xs text-stone-500">Column options are not available for statement reports.</p>
        </div>
      )}

      <div className="space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
            <ArrowLeft className="w-4 h-4" /> Back to standard reports
          </Link>
          {statement && (
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
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            {/* Client */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Client</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                <option value="">Select a client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* From */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]" />
            </div>
            {/* To */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={apply}
              disabled={!clientId}
              className="px-4 py-2 bg-[#0d3d3b] text-white rounded-lg text-sm font-medium hover:bg-[#0a5c5a] disabled:opacity-40 transition-colors"
            >
              Generate Statement
            </button>
          </div>
        </div>

        {/* Statement or empty state */}
        {!statement && !initialClientId && (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-stone-400 text-sm">
            Select a client above to generate a statement.
          </div>
        )}

        {statement && selectedClient && (
          <StatementView
            clientName={selectedClient.name}
            statement={statement}
            asOf={asOf}
            fromDate={fromDate || undefined}
            toDate={toDate || undefined}
          />
        )}
      </div>
    </>
  );
}
