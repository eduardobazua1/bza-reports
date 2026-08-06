"use client";

import { useState, useTransition } from "react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { apiMutate } from "@/lib/api-mutate";
import { markInvoicesPaid } from "@/server/actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckCircle2, Trash2 } from "lucide-react";
import { APOverview } from "@/components/ap-overview";

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
      await apiMutate("/api/supplier-payments", {
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
      onSaved(); // only after the server confirms
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save the payment.");
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
      await apiMutate(`/api/supplier-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualTons: parseFloat(actualTons),
          adjustmentStatus: settleNow ? "settled" : undefined,
        }),
      });
      onSaved(); // only after the server confirms
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't confirm the actual tons.");
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
          <div className={`rounded-lg p-3 text-sm space-y-1 ${adj > 0.01 ? "bg-[#0d3d3b]/8 border border-[#0d3d3b]/25" : adj < -0.01 ? "bg-[#0d3d3b]/5 border border-[#0d3d3b]/20" : "bg-stone-50 border border-stone-200"}`}>
            <div className="flex justify-between text-xs">
              <span className="text-stone-500">Difference</span>
              <span className="font-medium text-[#0d3d3b]">{(actual - estTons) > 0 ? "+" : ""}{(actual - estTons).toFixed(3)} TN</span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-stone-600">
                {adj > 0.01 ? "BZA owes supplier" : adj < -0.01 ? "Supplier owes BZA" : "No adjustment"}
              </span>
              <span className={adj > 0.01 ? "text-[#0d3d3b]" : adj < -0.01 ? "text-[#0d3d3b]" : "text-stone-400"}>
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
      await apiMutate(`/api/supplier-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustmentStatus: "settled" }),
      });
      onSaved(); // only after the server confirms
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't settle the adjustment.");
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
            <span className="font-semibold text-[#0d3d3b]">
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

// ─── A/P: Assign PO Modal ─────────────────────────────────────────────────────
function AssignPOModal({
  payment,
  purchaseOrdersList,
  onClose,
  onSaved,
}: {
  payment: SupplierPayment;
  purchaseOrdersList: POOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedPoId, setSelectedPoId] = useState<string>(
    payment.purchaseOrderId ? String(payment.purchaseOrderId) : ""
  );
  const [saving, setSaving] = useState(false);

  // Filter POs to the same supplier
  const matchingPOs = purchaseOrdersList.filter(po => po.supplierId === payment.supplierId);
  const otherPOs = purchaseOrdersList.filter(po => po.supplierId !== payment.supplierId);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPoId) return;
    setSaving(true);
    try {
      await apiMutate(`/api/supplier-payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseOrderId: Number(selectedPoId) }),
      });
      onSaved(); // only after the server confirms
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't assign the PO.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-stone-800">Assign to Purchase Order</h3>
          <p className="text-xs text-stone-400 mt-0.5">{formatDate(payment.paymentDate)} · {formatCurrency(payment.amountUsd)}</p>
        </div>

        <div className="bg-stone-50 rounded-lg p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-400">Supplier</span>
            <span className="font-medium text-[#0d3d3b]">{payment.supplierName?.split("(")[0].trim() || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Amount Paid</span>
            <span className="font-semibold text-[#0d3d3b]">{formatCurrency(payment.amountUsd)}</span>
          </div>
          {payment.estimatedTons && (
            <div className="flex justify-between">
              <span className="text-stone-400">Est. Tons</span>
              <span className="text-[#0d3d3b]">{payment.estimatedTons.toFixed(3)} TN</span>
            </div>
          )}
          {payment.notes && (
            <div className="flex justify-between gap-2">
              <span className="text-stone-400 shrink-0">Notes</span>
              <span className="text-[#0d3d3b] text-right">{payment.notes}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleAssign} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#0d3d3b] mb-1">Purchase Order</label>
            <select
              required
              value={selectedPoId}
              onChange={e => setSelectedPoId(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
            >
              <option value="">— Select PO —</option>
              {matchingPOs.length > 0 && (
                <optgroup label={`${payment.supplierName?.split("(")[0].trim()} (same supplier)`}>
                  {matchingPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.poNumber}</option>
                  ))}
                </optgroup>
              )}
              {otherPOs.length > 0 && (
                <optgroup label="Other suppliers">
                  {otherPOs.map(po => (
                    <option key={po.id} value={po.id}>{po.poNumber} — {po.supplierName?.split("(")[0].trim()}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !selectedPoId}
              className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">
              {saving ? "Saving..." : "Assign PO"}
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

type POOption = {
  id: number;
  poNumber: string | null;
  supplierId: number;
  supplierName: string | null;
};

type OutstandingSupplierInvoice = {
  id: number;
  purchaseOrderId: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  estimatedTons: number | null;
  amountUsd: number | null;
  notes: string | null;
  fileName: string | null;
  fileUrl: string | null;
  paymentStatus: string;
  poNumber: string | null;
  supplierName: string | null;
};

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
  purchaseOrdersList = [],
  outstandingSupplierInvoices = [],
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
  purchaseOrdersList?: POOption[];
  outstandingSupplierInvoices?: OutstandingSupplierInvoice[];
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
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<SupplierPayment | null>(null);
  const [settlePayment, setSettlePayment] = useState<SupplierPayment | null>(null);
  const [assignPayment, setAssignPayment] = useState<SupplierPayment | null>(null);
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
      await apiMutate(`/api/supplier-payments/${id}`, { method: "DELETE" });
      router.refresh(); // only after the server confirms
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete this payment.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── ACCOUNTS PAYABLE ──────────────────────────────────────────────────────
  if (isAP) {
    const unlinkedPayments = supplierPayments.filter(p => !p.purchaseOrderId);
    const unlinkedTotal = unlinkedPayments.reduce((s, p) => s + p.amountUsd, 0);

    return (
      <div className="space-y-6">
        {/* Unlinked payments banner */}
        {unlinkedPayments.length > 0 && (
          <div className="flex items-start gap-3 bg-[#0d3d3b]/8 border border-[#0d3d3b]/25 rounded-lg px-4 py-3">
            <span className="text-[#0d3d3b] text-lg leading-none mt-0.5">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0d3d3b]">
                {unlinkedPayments.length} payment{unlinkedPayments.length !== 1 ? "s" : ""} ({formatCurrency(unlinkedTotal)}) not linked to a PO
              </p>
              <p className="text-xs text-[#0d3d3b]/70 mt-0.5">
                Use the <strong>Assign PO</strong> button on each row below to link them — this enables the prepaid balance reconciliation.
              </p>
            </div>
          </div>
        )}

        <APOverview
          supplierInvoices={outstandingSupplierInvoices}
          supplierPayments={supplierPayments}
          onAddPayment={() => setShowAddPayment(true)}
        />

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
        {assignPayment && (
          <AssignPOModal
            payment={assignPayment}
            purchaseOrdersList={purchaseOrdersList}
            onClose={() => setAssignPayment(null)}
            onSaved={() => { setAssignPayment(null); router.refresh(); }}
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
                <span className="text-xs text-stone-500">Select invoices from one client only</span>
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
                            ? <span className="text-stone-600 font-medium">+{daysOverdue}d overdue</span>
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
