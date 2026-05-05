"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { markInvoicesPaid } from "@/server/actions";
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold text-stone-800">{value}</p>
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
  defaultTab = "customer",
}: {
  customerPayments: CustomerPayment[];
  unpaidInvoices: UnpaidInvoice[];
  supplierPayments: SupplierPayment[];
  totalAR: number;
  overdueAR: number;
  totalCollected: number;
  totalSupplierPaid: number;
  defaultTab?: "customer" | "supplier";
}) {
  const [subTab, setSubTab] = useState<"unpaid" | "history">("unpaid");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("wire_transfer");
  const [referenceNo, setReferenceNo] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];
  const isAP = defaultTab === "supplier";

  function toggleInv(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedInvoices = unpaidInvoices.filter(inv => selected.has(inv.id));
  const selectedAmount = selectedInvoices.reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);
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

  // Group supplier totals for KPI
  const supplierTotals: Record<string, { name: string; total: number }> = {};
  for (const p of supplierPayments) {
    const key = String(p.supplierId);
    if (!supplierTotals[key]) supplierTotals[key] = { name: p.supplierName?.split("(")[0].trim() || "Unknown", total: 0 };
    supplierTotals[key].total += p.amountUsd;
  }

  // ── ACCOUNTS PAYABLE ──
  if (isAP) {
    return (
      <div className="space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Paid Out"
            value={formatCurrency(totalSupplierPaid)}
            sub={`${supplierPayments.length} payments`}
          />
          {Object.values(supplierTotals).map(s => (
            <StatCard key={s.name} label={s.name} value={formatCurrency(s.total)} />
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Supplier</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">PO</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Amount</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Est. Tons</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Actual Tons</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Adj.</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Method</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Reference</th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-stone-400">No supplier payments recorded.</td>
                  </tr>
                )}
                {supplierPayments.map(p => {
                  const adj = p.adjustmentAmount;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                      <td className="p-3 text-stone-600">{formatDate(p.paymentDate)}</td>
                      <td className="p-3 font-medium text-stone-800">{p.supplierName || "—"}</td>
                      <td className="p-3 text-stone-500">{p.poNumber || "—"}</td>
                      <td className="p-3 text-right font-semibold text-stone-800">{formatCurrency(p.amountUsd)}</td>
                      <td className="p-3 text-right text-stone-500">{p.estimatedTons?.toFixed(1) ?? "—"}</td>
                      <td className="p-3 text-right text-stone-500">{p.actualTons?.toFixed(1) ?? "—"}</td>
                      <td className={`p-3 text-right font-medium ${
                        adj == null ? "text-stone-300"
                        : adj > 0 ? "text-amber-600"
                        : adj < 0 ? "text-red-600"
                        : "text-stone-400"
                      }`}>
                        {adj != null ? (adj > 0 ? "+" : "") + formatCurrency(adj) : "—"}
                      </td>
                      <td className="p-3 text-stone-500">{p.paymentMethod || "—"}</td>
                      <td className="p-3 text-stone-500">{p.reference || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {supplierPayments.length > 0 && (
                <tfoot>
                  <tr className="bg-muted font-semibold border-t-2 border-border">
                    <td className="p-3 text-stone-700" colSpan={3}>TOTAL</td>
                    <td className="p-3 text-right text-stone-800">{formatCurrency(totalSupplierPaid)}</td>
                    <td colSpan={5} className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── ACCOUNTS RECEIVABLE ──
  const overdueCount = unpaidInvoices.filter(i => i.dueDate && i.dueDate < today).length;
  const allSelected = unpaidInvoices.length > 0 && unpaidInvoices.every(i => selected.has(i.id));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Outstanding AR"
          value={formatCurrency(totalAR)}
          sub={`${unpaidInvoices.length} invoices`}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(overdueAR)}
          sub={`${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total Collected"
          value={formatCurrency(totalCollected)}
          sub={`${customerPayments.length} payments`}
        />
        <StatCard
          label="Net Position"
          value={formatCurrency(totalCollected - totalAR)}
        />
      </div>

      {/* Border-b tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        {(["unpaid", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              subTab === t
                ? "border-primary text-primary"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {t === "unpaid"
              ? `Outstanding (${unpaidInvoices.length})`
              : `History (${customerPayments.length})`}
          </button>
        ))}
      </div>

      {/* Outstanding (unpaid invoices) */}
      {subTab === "unpaid" && (
        <div className="space-y-3">
          {/* Selection action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-muted border border-border rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium text-stone-700">
                {selected.size} invoice{selected.size > 1 ? "s" : ""} selected —{" "}
                {formatCurrency(selectedAmount)}
              </span>
              {!canMarkPaid && (
                <span className="text-xs text-red-500">Select invoices from one client only</span>
              )}
              {canMarkPaid && (
                <button
                  onClick={() => setShowMarkPaid(true)}
                  className="ml-auto text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium hover:opacity-90"
                >
                  Mark as Paid
                </button>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className={`text-xs text-stone-400 hover:text-stone-600 ${canMarkPaid ? "" : "ml-auto"}`}
              >
                Clear
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {unpaidInvoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-400">All invoices are paid. 🎉</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(unpaidInvoices.map(i => i.id)))
                        }
                        className="accent-primary"
                      />
                    </th>
                    <th className="p-3 text-sm font-medium text-muted-foreground">Invoice #</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground">Client</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground">PO</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-right">Tons</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-right">Amount</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground">Ship Date</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.map(inv => {
                    const overdue = inv.dueDate && inv.dueDate < today;
                    const amount = inv.quantityTons * inv.sellPrice;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => toggleInv(inv.id)}
                        className={`border-t border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                          selected.has(inv.id) ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(inv.id)}
                            onChange={() => toggleInv(inv.id)}
                            onClick={e => e.stopPropagation()}
                            className="accent-primary"
                          />
                        </td>
                        <td className="p-3 font-medium text-stone-700">{inv.invoiceNumber}</td>
                        <td className="p-3 text-stone-700">{inv.clientName || "—"}</td>
                        <td className="p-3 text-stone-500">{inv.poNumber || "—"}</td>
                        <td className="p-3 text-right text-stone-700">{inv.quantityTons.toFixed(2)}</td>
                        <td className="p-3 text-right font-medium text-stone-800">{formatCurrency(amount)}</td>
                        <td className="p-3 text-stone-500">{formatDate(inv.shipmentDate)}</td>
                        <td className={`p-3 font-medium ${overdue ? "text-red-600" : "text-stone-600"}`}>
                          {formatDate(inv.dueDate)}{overdue && " ⚠"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payment history */}
      {subTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground text-right">Amount</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Method</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Reference</th>
                  <th className="p-3 text-sm font-medium text-muted-foreground">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {customerPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400">No payments recorded.</td>
                  </tr>
                )}
                {customerPayments.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-stone-600">{formatDate(p.paymentDate)}</td>
                    <td className="p-3 font-medium text-stone-800">{p.clientName || "—"}</td>
                    <td className="p-3 text-right font-semibold text-stone-800">{formatCurrency(p.amount)}</td>
                    <td className="p-3 text-stone-500">{METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                    <td className="p-3 text-stone-500">{p.referenceNo || "—"}</td>
                    <td className="p-3 text-stone-400">
                      {p.invoices.length > 0 ? p.invoices.map(i => i.invoiceNumber).join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showMarkPaid && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowMarkPaid(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-stone-800">Record Payment</h3>
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <p className="text-stone-500">
                Client:{" "}
                <span className="font-medium text-stone-800">{selectedInvoices[0]?.clientName}</span>
              </p>
              <p className="text-stone-500">
                Invoices:{" "}
                <span className="font-medium text-stone-800">
                  {selectedInvoices.map(i => i.invoiceNumber).join(", ")}
                </span>
              </p>
              <p className="text-stone-500">
                Total:{" "}
                <span className="font-bold text-stone-800">{formatCurrency(selectedAmount)}</span>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {Object.entries(METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Reference No.</label>
                <input
                  value={referenceNo}
                  onChange={e => setReferenceNo(e.target.value)}
                  placeholder="Wire reference, transaction ID..."
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleMarkPaid}
                disabled={isPending}
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Confirm Payment"}
              </button>
              <button
                onClick={() => setShowMarkPaid(false)}
                className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
