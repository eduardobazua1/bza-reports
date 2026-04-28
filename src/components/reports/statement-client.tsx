"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Printer, ChevronDown } from "lucide-react";
import Link from "next/link";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  wire_transfer:    "Wire Transfer",
  cv_credit:        "CV Credit",
  xepellin:         "Xepellin",
  factoraje_bbva:   "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other:            "Other",
};

function txDate(tx: { invoiceDate?: string | null; shipmentDate?: string | null; paymentDate?: string; memoDate?: string }) {
  return tx.paymentDate ?? tx.memoDate ?? tx.invoiceDate ?? tx.shipmentDate ?? "";
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

  const selectedClient = clients.find(c => c.id === Number(clientId));

  function apply() {
    if (!clientId) return;
    const params = new URLSearchParams({ client: clientId });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    router.push(`/reports/statements?${params.toString()}`);
  }

  const asOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> Back to standard reports
        </Link>
        {statement && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 print:hidden"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
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
  );
}
