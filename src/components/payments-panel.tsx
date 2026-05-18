"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { markInvoicesPaid } from "@/server/actions";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CheckCircle2, Trash2 } from "lucide-react";

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

type UnpaidSupplierInvoice = {
  id: number;
  invoiceNumber: string;
  quantityTons: number;
  shipmentDate: string | null;
  supplierId: number | null;
  supplierName: string | null;
  poNumber: string | null;
  purchaseOrderId: number | null;
  buyPrice: number;
};

type LinkedInvoice = {
  id: number;
  paymentId: number;
  invoiceId: number | null;
  invoiceNumber: string;
  estimatedTons: number | null;
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
  pricePerTon: number | null;
  actualTons: number | null;
  actualAmount: number | null;
  adjustmentAmount: number | null;
  adjustmentStatus: string | null;
  invoices: LinkedInvoice[];
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
    <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ─── A/P: Add Payment Modal ───────────────────────────────────────────────────
function AddPaymentModal({
  unpaidSupplierInvoices,
  onClose,
  onSaved,
}: {
  unpaidSupplierInvoices: UnpaidSupplierInvoice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    amountUsd: "",
    pricePerTon: "",
    paymentMethod: "wire_transfer",
    reference: "",
    notes: "",
  });

  // Group unpaid invoices by supplier
  const bySupplier: Record<string, { name: string; invoices: UnpaidSupplierInvoice[] }> = {};
  for (const inv of unpaidSupplierInvoices) {
    const key = String(inv.supplierId ?? "unknown");
    if (!bySupplier[key]) bySupplier[key] = { name: inv.supplierName || "Unknown", invoices: [] };
    bySupplier[key].invoices.push(inv);
  }

  const selectedInvoices = unpaidSupplierInvoices.filter(i => selectedInvoiceIds.has(i.id));
  const estimatedTons = selectedInvoices.reduce((s, i) => s + i.quantityTons, 0);
  const priceNum = parseFloat(form.pricePerTon) || 0;
  const autoAmount = estimatedTons > 0 && priceNum > 0
    ? (estimatedTons * priceNum).toFixed(2)
    : "";

  // Derive unique supplier + PO from selection
  const selectedSupplierId = selectedInvoices.length > 0 ? selectedInvoices[0].supplierId : null;
  const selectedPoId = selectedInvoices.length > 0 ? selectedInvoices[0].purchaseOrderId : null;

  function toggleInv(id: number) {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amountToSend = parseFloat(form.amountUsd) || parseFloat(autoAmount) || 0;
    if (!amountToSend || !form.paymentDate || !selectedSupplierId) return;

    setSaving(true);
    try {
      await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          purchaseOrderId: selectedPoId || null,
          amountUsd: amountToSend,
          paymentDate: form.paymentDate,
          estimatedTons: estimatedTons > 0 ? estimatedTons : null,
          pricePerTon: priceNum > 0 ? priceNum : null,
          paymentMethod: form.paymentMethod || null,
          reference: form.reference || null,
          notes: form.notes || null,
          invoices: selectedInvoices.map(inv => ({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            estimatedTons: inv.quantityTons,
          })),
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800 text-base">Record Supplier Payment</h3>
          <p className="text-xs text-stone-400 mt-0.5">Select invoices covered by this payment, then enter the amount paid</p>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* Step 1: Select invoices */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">Invoices covered</p>
            {Object.entries(bySupplier).map(([, { name, invoices: invs }]) => (
              <div key={name} className="mb-3">
                <p className="text-xs font-medium text-[#0d3d3b] mb-1.5">{name}</p>
                <div className="rounded-md border border-stone-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="w-8 p-2"></th>
                        <th className="text-left p-2 font-medium text-stone-400 uppercase tracking-wide">Invoice #</th>
                        <th className="text-left p-2 font-medium text-stone-400 uppercase tracking-wide">PO</th>
                        <th className="text-right p-2 font-medium text-stone-400 uppercase tracking-wide">Tons</th>
                        <th className="text-left p-2 font-medium text-stone-400 uppercase tracking-wide">Ship Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invs.map(inv => (
                        <tr key={inv.id} className={`border-t border-stone-100 cursor-pointer hover:bg-stone-50 ${selectedInvoiceIds.has(inv.id) ? "bg-[#0d3d3b]/5" : ""}`} onClick={() => toggleInv(inv.id)}>
                          <td className="p-2 text-center">
                            <input type="checkbox" checked={selectedInvoiceIds.has(inv.id)} onChange={() => toggleInv(inv.id)} onClick={e => e.stopPropagation()} className="accent-[#0d3d3b]" />
                          </td>
                          <td className="p-2 text-[#0d3d3b]">{inv.invoiceNumber}</td>
                          <td className="p-2 text-[#0d3d3b]">{inv.poNumber || "—"}</td>
                          <td className="p-2 text-right text-[#0d3d3b]">{inv.quantityTons.toFixed(2)}</td>
                          <td className="p-2 text-[#0d3d3b]">{formatDate(inv.shipmentDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {unpaidSupplierInvoices.length === 0 && (
              <p className="text-sm text-stone-400 py-3">No unpaid supplier invoices found.</p>
            )}
            {selectedInvoices.length > 0 && (
              <div className="flex items-center gap-3 bg-[#0d3d3b]/5 border border-[#0d3d3b]/20 rounded-lg px-3 py-2 mt-2">
                <span className="text-xs font-medium text-[#0d3d3b]">
                  {selectedInvoices.length} invoice{selectedInvoices.length !== 1 ? "s" : ""} selected
                </span>
                <span className="text-xs text-stone-500">·</span>
                <span className="text-xs font-semibold text-[#0d3d3b]">{formatNumber(estimatedTons, 3)} TN estimated</span>
              </div>
            )}
          </div>

          {/* Step 2: Payment details */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">Payment details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Payment Date *</label>
                <input type="date" required value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]" />
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Price / Ton (USD)</label>
                <input type="number" step="0.01" min="0" placeholder="e.g. 550.00" value={form.pricePerTon}
                  onChange={e => setForm(f => ({ ...f, pricePerTon: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]" />
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">
                  Amount Paid (USD) *
                  {autoAmount && <span className="text-stone-400 ml-1">— calc: {formatCurrency(parseFloat(autoAmount))}</span>}
                </label>
                <input type="number" step="0.01" min="0" required placeholder={autoAmount || "0.00"} value={form.amountUsd}
                  onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]" />
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Payment Method</label>
                <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]">
                  {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Reference No.</label>
                <input type="text" placeholder="Wire reference, check #..." value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]" />
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Notes</label>
                <input type="text" placeholder="Optional..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !selectedSupplierId}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
              {saving ? "Saving..." : "Record Payment"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── A/P: Confirm Actual Tons Modal ──────────────────────────────────────────
function ConfirmActualModal({
  payment,
  onClose,
  onSaved,
}: {
  payment: SupplierPayment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [actualTons, setActualTons] = useState(
    payment.actualTons != null ? String(payment.actualTons) : ""
  );
  const [saving, setSaving] = useState(false);

  const estTons = payment.estimatedTons || 0;
  const pricePerTon = payment.pricePerTon || (estTons > 0 ? payment.amountUsd / estTons : 0);
  const actual = parseFloat(actualTons) || 0;
  const adj = actual > 0 && estTons > 0 ? (actual - estTons) * pricePerTon : null;

  async function handleConfirm(settleNow: boolean) {
    if (!actualTons) return;
    setSaving(true);
    try {
      await fetch(`/api/supplier-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualTons: parseFloat(actualTons),
          adjustmentStatus: settleNow ? "settled" : undefined,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-stone-800">Confirm Actual Tonnage</h3>
          <p className="text-xs text-stone-400 mt-0.5">{payment.poNumber} · {payment.supplierName}</p>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-400">Payment Amount</span>
            <span className="font-semibold text-[#0d3d3b]">{formatCurrency(payment.amountUsd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Estimated Tons</span>
            <span className="text-[#0d3d3b]">{estTons.toFixed(3)} TN</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Price / Ton</span>
            <span className="text-[#0d3d3b]">{formatCurrency(pricePerTon)}</span>
          </div>
          {payment.invoices.length > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-400">Invoices covered</span>
              <span className="text-[#0d3d3b]">{payment.invoices.map(i => i.invoiceNumber).join(", ")}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Actual Tons Shipped</label>
          <input
            type="number" step="0.001" min="0" placeholder="e.g. 543.450"
            value={actualTons} onChange={e => setActualTons(e.target.value)}
            autoFocus
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]"
          />
        </div>

        {adj !== null && (
          <div className={`rounded-lg p-3 text-sm space-y-1 ${adj > 0.01 ? "bg-amber-50 border border-amber-200" : adj < -0.01 ? "bg-[#0d3d3b]/5 border border-[#0d3d3b]/20" : "bg-stone-50 border border-stone-200"}`}>
            <div className="flex justify-between text-xs">
              <span className="text-stone-500">Difference</span>
              <span className="font-medium text-[#0d3d3b]">{(actual - estTons) > 0 ? "+" : ""}{(actual - estTons).toFixed(3)} TN</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-stone-600">
                {adj > 0.01 ? "BZA owes supplier" : adj < -0.01 ? "Supplier owes BZA" : "No adjustment"}
              </span>
              <span className={adj > 0.01 ? "text-amber-700" : adj < -0.01 ? "text-[#0d3d3b]" : "text-stone-400"}>
                {Math.abs(adj) > 0.01 ? formatCurrency(Math.abs(adj)) : "Settled"}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={() => handleConfirm(false)} disabled={saving || !actualTons}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? "Saving..." : "Save — Mark Pending"}
          </button>
          {adj !== null && Math.abs(adj) < 0.01 && (
            <button onClick={() => handleConfirm(true)} disabled={saving}
              className="flex-1 bg-[#0d3d3b] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
              Mark Settled
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── A/P: Settle Modal ────────────────────────────────────────────────────────
function SettleAdjModal({
  payment,
  onClose,
  onSaved,
}: {
  payment: SupplierPayment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const adj = payment.adjustmentAmount || 0;

  async function handleSettle() {
    setSaving(true);
    try {
      await fetch(`/api/supplier-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustmentStatus: "settled" }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-stone-800">Settle Adjustment</h3>
        <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-stone-400">PO</span>
            <span className="text-[#0d3d3b]">{payment.poNumber}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-stone-400">Adjustment</span>
            <span className={`font-semibold ${adj > 0 ? "text-amber-700" : "text-[#0d3d3b]"}`}>
              {adj > 0 ? `BZA pays +${formatCurrency(adj)}` : `Supplier refunds ${formatCurrency(Math.abs(adj))}`}
            </span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSettle} disabled={saving}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
            {saving ? "..." : "Mark as Settled"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type SupplierBalance = {
  poId: number | null;
  poNumber: string | null;
  supplierName: string | null;
  totalPaid: number;
  totalShipped: number;
  balance: number;
};

export function PaymentsPanel({
  customerPayments,
  unpaidInvoices,
  supplierPayments,
  unpaidSupplierInvoices = [],
  supplierBalances = [],
  totalAR,
  overdueAR,
  totalCollected,
  totalSupplierPaid,
  defaultTab = "customer",
}: {
  customerPayments: CustomerPayment[];
  unpaidInvoices: UnpaidInvoice[];
  supplierPayments: SupplierPayment[];
  unpaidSupplierInvoices?: UnpaidSupplierInvoice[];
  supplierBalances?: SupplierBalance[];
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

  // A/P state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState<SupplierPayment | null>(null);
  const [settlePayment, setSettlePayment] = useState<SupplierPayment | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const isAP = defaultTab === "supplier";

  function toggleInv(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRow(id: number) {
    setExpandedRows(prev => {
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

  async function handleDeletePayment(id: number) {
    if (!confirm("Delete this payment record?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/supplier-payments/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  // ── ACCOUNTS PAYABLE ──────────────────────────────────────────────────────
  if (isAP) {
    // KPI calculations
    const pendingAdj = supplierPayments.filter(p => p.adjustmentStatus === "pending" && (p.adjustmentAmount || 0) > 0);
    const pendingCredits = supplierPayments.filter(p => p.adjustmentStatus === "pending" && (p.adjustmentAmount || 0) < 0);
    const totalBzaOwes = pendingAdj.reduce((s, p) => s + (p.adjustmentAmount || 0), 0);
    const totalCreditsOwed = pendingCredits.reduce((s, p) => s + Math.abs(p.adjustmentAmount || 0), 0);

    // Saldo a favor: POs where BZA prepaid more than what has shipped
    const saldoAFavor = supplierBalances.filter(b => b.balance > 0.01);
    const totalSaldoFavor = saldoAFavor.reduce((s, b) => s + b.balance, 0);

    return (
      <div className="space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Paid Out"
            value={formatCurrency(totalSupplierPaid)}
            sub={`${supplierPayments.length} payments`}
          />
          <StatCard
            label="Saldo a Favor"
            value={formatCurrency(totalSaldoFavor)}
            sub={`${saldoAFavor.length} PO${saldoAFavor.length !== 1 ? "s" : ""} prepaid`}
          />
          <StatCard
            label="BZA Owes (adj.)"
            value={formatCurrency(totalBzaOwes)}
            sub={`${pendingAdj.length} pending`}
          />
          <StatCard
            label="Supplier Owes BZA"
            value={formatCurrency(totalCreditsOwed)}
            sub={`${pendingCredits.length} credit${pendingCredits.length !== 1 ? "s" : ""}`}
          />
        </div>

        {/* Saldo a Favor breakdown */}
        {saldoAFavor.length > 0 && (
          <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-amber-500 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100">
              <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                Saldo a Favor — Prepagado Pendiente de Embarque
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                BZA ha pagado más de lo que el proveedor ha embarcado en estos contratos
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">PO</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Proveedor</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Pagado</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Embarcado</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Saldo a Favor</th>
                  </tr>
                </thead>
                <tbody>
                  {saldoAFavor.map(b => (
                    <tr key={b.poId} className="border-t border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-2.5 text-xs font-medium text-[#0d3d3b]">{b.poNumber || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-[#0d3d3b]">{b.supplierName?.split("(")[0].trim() || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(b.totalPaid)}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-[#0d3d3b]">{formatCurrency(b.totalShipped)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-semibold text-amber-600">{formatCurrency(b.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-stone-600">TOTAL SALDO A FAVOR</td>
                    <td className="px-4 py-2 text-xs text-right font-bold text-amber-600">{formatCurrency(totalSaldoFavor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Table header + add button */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Payment History</h2>
          <button
            onClick={() => setShowAddPayment(true)}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            + Add Payment
          </button>
        </div>

        {/* Payments table */}
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-3 w-8"></th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Date</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Supplier</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">PO</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-center">Invoices</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Est. TN</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Act. TN</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">$/TN</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Amount Paid</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Adjustment</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Status</th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-stone-400">
                      No supplier payments recorded. Click "+ Add Payment" to start tracking.
                    </td>
                  </tr>
                )}
                {supplierPayments.map(p => {
                  const adj = p.adjustmentAmount;
                  const isExpanded = expandedRows.has(p.id);
                  const needsActual = p.invoices.length > 0 && p.actualTons == null;
                  const derivedPpt = p.pricePerTon || (p.estimatedTons && p.estimatedTons > 0 ? p.amountUsd / p.estimatedTons : null);
                  const statusLabel =
                    p.adjustmentStatus === "settled" ? "Settled"
                    : p.adjustmentStatus === "pending" ? "Pending"
                    : p.actualTons != null ? "Confirmed"
                    : p.invoices.length > 0 ? "Awaiting Shipment"
                    : "—";
                  const statusColor =
                    p.adjustmentStatus === "settled" ? "bg-emerald-50 text-emerald-700"
                    : p.adjustmentStatus === "pending" ? "bg-amber-50 text-amber-700"
                    : p.actualTons != null ? "bg-stone-100 text-[#0d3d3b]"
                    : p.invoices.length > 0 ? "bg-stone-100 text-stone-500"
                    : "bg-stone-50 text-stone-400";

                  return (
                    <>
                      <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          {p.invoices.length > 0 && (
                            <button onClick={() => toggleRow(p.id)} className="text-stone-400 hover:text-stone-600">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{formatDate(p.paymentDate)}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{p.supplierName?.split("(")[0].trim() || "—"}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{p.poNumber || "—"}</td>
                        <td className="p-3 text-xs text-center text-[#0d3d3b]">
                          {p.invoices.length > 0 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0d3d3b]/10 text-[10px] font-semibold text-[#0d3d3b]">
                              {p.invoices.length}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-xs text-right text-[#0d3d3b]">{p.estimatedTons?.toFixed(3) ?? "—"}</td>
                        <td className={`p-3 text-xs text-right ${p.actualTons != null ? "text-[#0d3d3b] font-medium" : "text-stone-300"}`}>
                          {p.actualTons?.toFixed(3) ?? "—"}
                        </td>
                        <td className="p-3 text-xs text-right text-[#0d3d3b]">
                          {derivedPpt ? formatCurrency(derivedPpt) : "—"}
                        </td>
                        <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(p.amountUsd)}</td>
                        <td className={`p-3 text-xs text-right font-semibold ${
                          adj == null ? "text-stone-300"
                          : adj > 0.01 ? "text-amber-600"
                          : adj < -0.01 ? "text-[#0d3d3b]"
                          : "text-stone-400"
                        }`}>
                          {adj != null && Math.abs(adj) > 0.01
                            ? (adj > 0 ? `+${formatCurrency(adj)}` : `−${formatCurrency(Math.abs(adj))}`)
                            : adj != null ? "—" : "—"}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 justify-end">
                            {needsActual && (
                              <button
                                onClick={() => setConfirmPayment(p)}
                                title="Confirm actual tons"
                                className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#0d3d3b]/10 text-[#0d3d3b] hover:bg-[#0d3d3b]/20"
                              >
                                Confirm
                              </button>
                            )}
                            {p.adjustmentStatus === "pending" && adj != null && Math.abs(adj) > 0.01 && (
                              <button
                                onClick={() => setSettlePayment(p)}
                                title="Settle adjustment"
                                className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                <CheckCircle2 className="w-3 h-3 inline mr-0.5" />Settle
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              disabled={deletingId === p.id}
                              title="Delete"
                              className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === p.id ? "…" : <Trash2 className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && p.invoices.length > 0 && (
                        <tr key={`${p.id}-exp`} className="bg-stone-50 border-t border-stone-100">
                          <td colSpan={12} className="px-8 py-3">
                            <p className="text-[10px] uppercase font-semibold tracking-widest text-stone-400 mb-2">Invoices covered by this payment</p>
                            <div className="flex flex-wrap gap-2">
                              {p.invoices.map(inv => (
                                <div key={inv.id} className="flex items-center gap-1.5 bg-white border border-stone-200 rounded px-2 py-1">
                                  <span className="text-xs font-medium text-[#0d3d3b]">{inv.invoiceNumber}</span>
                                  {inv.estimatedTons && (
                                    <span className="text-[10px] text-stone-400">{inv.estimatedTons.toFixed(3)} TN</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              {supplierPayments.length > 0 && (
                <tfoot>
                  <tr className="bg-muted font-semibold border-t-2 border-border">
                    <td className="p-3 text-xs text-[#0d3d3b]" colSpan={8}>TOTAL</td>
                    <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(totalSupplierPaid)}</td>
                    <td colSpan={3} className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {showAddPayment && (
          <AddPaymentModal
            unpaidSupplierInvoices={unpaidSupplierInvoices}
            onClose={() => setShowAddPayment(false)}
            onSaved={() => { setShowAddPayment(false); router.refresh(); }}
          />
        )}
        {confirmPayment && (
          <ConfirmActualModal
            payment={confirmPayment}
            onClose={() => setConfirmPayment(null)}
            onSaved={() => { setConfirmPayment(null); router.refresh(); }}
          />
        )}
        {settlePayment && (
          <SettleAdjModal
            payment={settlePayment}
            onClose={() => setSettlePayment(null)}
            onSaved={() => { setSettlePayment(null); router.refresh(); }}
          />
        )}
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

          <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] overflow-hidden">
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
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Invoice #</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Client</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">PO</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Tons</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Amount</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Ship Date</th>
                    <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.map(inv => {
                    const overdue = inv.dueDate && inv.dueDate < today;
                    const daysOverdue = overdue && inv.dueDate
                      ? Math.floor((new Date(today).getTime() - new Date(inv.dueDate).getTime()) / 86_400_000)
                      : 0;
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
                        <td className="p-3 text-xs text-[#0d3d3b]">{inv.invoiceNumber}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{inv.clientName || "—"}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{inv.poNumber || "—"}</td>
                        <td className="p-3 text-xs text-right text-[#0d3d3b]">{inv.quantityTons.toFixed(2)}</td>
                        <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(amount)}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">{formatDate(inv.shipmentDate)}</td>
                        <td className="p-3 text-xs text-[#0d3d3b]">
                          {overdue
                            ? <span className="text-red-600 font-medium">+{daysOverdue}d overdue</span>
                            : <span>{formatDate(inv.dueDate)}</span>
                          }
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
        <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Date</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Client</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Amount</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Method</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Reference</th>
                  <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Invoices</th>
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
                    <td className="p-3 text-xs text-[#0d3d3b]">{formatDate(p.paymentDate)}</td>
                    <td className="p-3 text-xs text-[#0d3d3b]">{p.clientName || "—"}</td>
                    <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">{formatCurrency(p.amount)}</td>
                    <td className="p-3 text-xs text-[#0d3d3b]">{METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
                    <td className="p-3 text-xs text-[#0d3d3b]">{p.referenceNo || "—"}</td>
                    <td className="p-3 text-xs text-stone-400">
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
                <label className="block text-xs text-[#0d3d3b] mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#0d3d3b] mb-1">Payment Method</label>
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
                <label className="block text-xs text-[#0d3d3b] mb-1">Reference No.</label>
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
