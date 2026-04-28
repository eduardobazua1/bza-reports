"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { markInvoicesPaid, markInvoiceUnpaid } from "@/server/actions";
import { useRouter } from "next/navigation";

type CustomerPayment = {
  id: number;
  clientId: number;
  clientName: string | null;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string | null;
  notes: string | null;
  invoices: { invoiceNumber: string; amount: number }[];
};

type UnpaidInvoice = {
  id: number;
  invoiceNumber: string;
  quantityTons: number;
  shipmentDate: string | null;
  dueDate: string | null;
  clientId: number | null;
  clientName: string | null;
  poNumber: string | null;
  sellPrice: number;
};

type SupplierPayment = {
  id: number;
  supplierId: number;
  supplierName: string | null;
  purchaseOrderId: number | null;
  poNumber: string | null;
  amountUsd: number;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  estimatedTons: number | null;
  actualTons: number | null;
  adjustmentAmount: number | null;
  adjustmentStatus: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  wire_transfer: "Wire Transfer",
  cv_credit: "CV Credit",
  xepellin: "Xepellin",
  factoraje_bbva: "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other: "Other",
};

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "red" | "green" | "default" }) {
  const color = accent === "red" ? "text-red-600" : accent === "green" ? "text-[#0d9488]" : "text-stone-800";
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-1">
      <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export function PaymentsPanel({
  customerPayments,
  unpaidInvoices,
  supplierPayments,
  totalAR,
  overdueAR,
  totalCollected,
  totalSupplierPaid,
}: {
  customerPayments: CustomerPayment[];
  unpaidInvoices: UnpaidInvoice[];
  supplierPayments: SupplierPayment[];
  totalAR: number;
  overdueAR: number;
  totalCollected: number;
  totalSupplierPaid: number;
}) {
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [subTab, setSubTab] = useState<"history" | "unpaid">("unpaid");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("wire_transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  // Group unpaid invoices by client
  const byClient: Record<string, { clientId: number; clientName: string; invoices: UnpaidInvoice[] }> = {};
  for (const inv of unpaidInvoices) {
    const key = String(inv.clientId ?? "unknown");
    if (!byClient[key]) byClient[key] = { clientId: inv.clientId ?? 0, clientName: inv.clientName || "Unknown", invoices: [] };
    byClient[key].invoices.push(inv);
  }

  function toggleInv(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleClient(ids: number[]) {
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  const selectedInvoices = unpaidInvoices.filter(inv => selected.has(inv.id));
  const selectedAmount = selectedInvoices.reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);

  // All selected must belong to the same client
  const selectedClientIds = [...new Set(selectedInvoices.map(inv => inv.clientId))];
  const canMarkPaid = selected.size > 0 && selectedClientIds.length === 1;

  function handleMarkPaid() {
    if (!canMarkPaid) return;
    startTransition(async () => {
      await markInvoicesPaid(
        [...selected],
        paidDate,
        paymentMethod,
        referenceNo,
        selectedClientIds[0]!,
        selectedInvoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.quantityTons * inv.sellPrice,
        }))
      );
      setSelected(new Set());
      setShowMarkPaid(false);
      setReferenceNo("");
      router.refresh();
    });
  }

  // Group supplier payments by supplier
  const supplierTotals: Record<string, { name: string; total: number }> = {};
  for (const p of supplierPayments) {
    const key = String(p.supplierId);
    if (!supplierTotals[key]) supplierTotals[key] = { name: p.supplierName || "Unknown", total: 0 };
    supplierTotals[key].total += p.amountUsd;
  }

  return (
    <div className="space-y-6">
      {/* Main tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["customer", "supplier"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "customer" ? "Customer Payments" : "Supplier Payments"}
          </button>
        ))}
      </div>

      {/* ── CUSTOMER TAB ── */}
      {tab === "customer" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Outstanding AR" value={formatCurrency(totalAR)} sub={`${unpaidInvoices.length} invoices`} />
            <KpiCard label="Overdue" value={formatCurrency(overdueAR)} accent="red"
              sub={`${unpaidInvoices.filter(i => i.dueDate && i.dueDate < today).length} invoices`} />
            <KpiCard label="Total Collected" value={formatCurrency(totalCollected)} accent="green" sub={`${customerPayments.length} payments`} />
            <KpiCard label="Net Position" value={formatCurrency(totalCollected - totalAR)}
              accent={totalCollected >= totalAR ? "green" : "default"} />
          </div>

          {/* Sub tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            {(["unpaid", "history"] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${subTab === t ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "unpaid" ? `Unpaid (${unpaidInvoices.length})` : `History (${customerPayments.length})`}
              </button>
            ))}
          </div>

          {/* Unpaid invoices */}
          {subTab === "unpaid" && (
            <div className="space-y-3">
              {selected.size > 0 && (
                <div className="flex items-center gap-3 bg-[#0d3d3b]/5 border border-[#0d3d3b]/20 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-[#0d3d3b]">{selected.size} invoice{selected.size > 1 ? "s" : ""} selected — {formatCurrency(selectedAmount)}</span>
                  {!canMarkPaid && selected.size > 0 && (
                    <span className="text-xs text-red-500">Select invoices from one client only</span>
                  )}
                  {canMarkPaid && (
                    <button onClick={() => setShowMarkPaid(true)}
                      className="ml-auto text-sm bg-[#0d9488] text-white px-4 py-1.5 rounded-lg font-medium hover:bg-[#0a7970]">
                      Mark as Paid
                    </button>
                  )}
                  <button onClick={() => setSelected(new Set())} className="text-xs text-stone-400 hover:text-stone-600">Clear</button>
                </div>
              )}

              {Object.values(byClient).length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-sm text-stone-400">
                  All invoices are paid.
                </div>
              )}

              {Object.values(byClient).map(({ clientId, clientName, invoices: clientInvs }) => {
                const clientTotal = clientInvs.reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);
                const clientIds = clientInvs.map(i => i.id);
                const allSel = clientIds.every(id => selected.has(id));
                return (
                  <div key={clientId} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={allSel} onChange={() => toggleClient(clientIds)}
                          className="accent-[#0d3d3b]" />
                        <span className="text-sm font-semibold text-stone-800">{clientName}</span>
                        <span className="text-xs text-stone-400">{clientInvs.length} invoice{clientInvs.length > 1 ? "s" : ""}</span>
                      </div>
                      <span className="text-sm font-bold text-stone-800">{formatCurrency(clientTotal)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-stone-400 border-b border-stone-100">
                          <th className="px-4 py-2 w-8"></th>
                          <th className="px-4 py-2">Invoice #</th>
                          <th className="px-4 py-2">PO</th>
                          <th className="px-4 py-2 text-right">Tons</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2">Ship Date</th>
                          <th className="px-4 py-2">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvs.map(inv => {
                          const overdue = inv.dueDate && inv.dueDate < today;
                          const amount = inv.quantityTons * inv.sellPrice;
                          return (
                            <tr key={inv.id} onClick={() => toggleInv(inv.id)}
                              className={`border-t border-stone-50 cursor-pointer hover:bg-stone-50 ${selected.has(inv.id) ? "bg-[#0d9488]/5" : ""}`}>
                              <td className="px-4 py-2.5">
                                <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleInv(inv.id)}
                                  onClick={e => e.stopPropagation()} className="accent-[#0d3d3b]" />
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                              <td className="px-4 py-2.5 text-stone-500 text-xs">{inv.poNumber || "—"}</td>
                              <td className="px-4 py-2.5 text-right">{inv.quantityTons.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(amount)}</td>
                              <td className="px-4 py-2.5 text-stone-500">{formatDate(inv.shipmentDate)}</td>
                              <td className={`px-4 py-2.5 font-medium ${overdue ? "text-red-600" : "text-stone-600"}`}>
                                {formatDate(inv.dueDate)}{overdue && " ⚠"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment history */}
          {subTab === "history" && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr className="text-left text-xs text-stone-500 font-semibold uppercase tracking-wide">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPayments.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No payments recorded.</td></tr>
                    )}
                    {customerPayments.map(p => (
                      <tr key={p.id} className="border-t border-stone-50 hover:bg-stone-50">
                        <td className="px-4 py-3 text-stone-600">{formatDate(p.paymentDate)}</td>
                        <td className="px-4 py-3 font-medium">{p.clientName || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#0d9488]">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 text-stone-500 text-xs">{METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                        <td className="px-4 py-3 text-stone-500 font-mono text-xs">{p.referenceNo || "—"}</td>
                        <td className="px-4 py-3 text-xs text-stone-400">
                          {p.invoices.length > 0 ? p.invoices.map(i => i.invoiceNumber).join(", ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUPPLIER TAB ── */}
      {tab === "supplier" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Total Paid Out" value={formatCurrency(totalSupplierPaid)} sub={`${supplierPayments.length} payments`} />
            {Object.values(supplierTotals).map(s => (
              <KpiCard key={s.name} label={s.name} value={formatCurrency(s.total)} />
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr className="text-left text-xs text-stone-500 font-semibold uppercase tracking-wide">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">PO</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Est. Tons</th>
                    <th className="px-4 py-3 text-right">Actual Tons</th>
                    <th className="px-4 py-3 text-right">Adj.</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPayments.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-stone-400">No supplier payments.</td></tr>
                  )}
                  {supplierPayments.map(p => {
                    const adj = p.adjustmentAmount;
                    return (
                      <tr key={p.id} className="border-t border-stone-50 hover:bg-stone-50">
                        <td className="px-4 py-3 text-stone-600">{formatDate(p.paymentDate)}</td>
                        <td className="px-4 py-3 font-medium">{p.supplierName || "—"}</td>
                        <td className="px-4 py-3 text-stone-500 text-xs font-mono">{p.poNumber || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#0d3d3b]">{formatCurrency(p.amountUsd)}</td>
                        <td className="px-4 py-3 text-right text-stone-500">{p.estimatedTons?.toFixed(1) ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-stone-500">{p.actualTons?.toFixed(1) ?? "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium text-xs ${adj == null ? "text-stone-300" : adj > 0 ? "text-amber-600" : adj < 0 ? "text-red-600" : "text-stone-400"}`}>
                          {adj != null ? (adj > 0 ? "+" : "") + formatCurrency(adj) : "—"}
                        </td>
                        <td className="px-4 py-3 text-stone-500 text-xs">{p.paymentMethod || "—"}</td>
                        <td className="px-4 py-3 text-stone-500 font-mono text-xs">{p.reference || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showMarkPaid && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowMarkPaid(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-800">Record Payment</h3>
            <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-stone-500">Client: <span className="font-medium text-stone-800">{selectedInvoices[0]?.clientName}</span></p>
              <p className="text-stone-500">Invoices: <span className="font-medium text-stone-800">{selectedInvoices.map(i => i.invoiceNumber).join(", ")}</span></p>
              <p className="text-stone-500">Total: <span className="font-bold text-[#0d9488]">{formatCurrency(selectedAmount)}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Payment Date</label>
                <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Reference No.</label>
                <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                  placeholder="Wire reference, transaction ID..."
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleMarkPaid} disabled={isPending}
                className="flex-1 bg-[#0d9488] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#0a7970] disabled:opacity-50">
                {isPending ? "Saving..." : "Confirm Payment"}
              </button>
              <button onClick={() => setShowMarkPaid(false)}
                className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
