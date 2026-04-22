"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: number;
  amountUsd: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
};

export function POSupplierPayments({
  purchaseOrderId,
  supplierId,
  payments,
  totalCost,
}: {
  purchaseOrderId: number;
  supplierId: number;
  payments: Payment[];
  totalCost: number;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState({
    amountUsd: "",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  const totalPaid = payments.reduce((s, p) => s + p.amountUsd, 0);
  const balance = totalCost - totalPaid;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amountUsd || !form.paymentDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          purchaseOrderId,
          amountUsd: parseFloat(form.amountUsd),
          paymentDate: form.paymentDate,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setForm({ amountUsd: "", paymentDate: new Date().toISOString().split("T")[0], reference: "", notes: "" });
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this payment?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/supplier-payments/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="bg-white rounded-md shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Supplier Payments</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} · Total paid:{" "}
            <span className="font-medium text-stone-600">{formatCurrency(totalPaid)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium bg-[#0d3d3b] text-white rounded-md hover:bg-[#0a2e2c] transition-colors"
        >
          + Add Payment
        </button>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-3 divide-x divide-stone-100 bg-stone-50 border-b border-stone-200">
        <div className="p-3 text-center">
          <p className="text-[10px] text-stone-400 uppercase tracking-wide">Invoiced Cost</p>
          <p className="text-base font-semibold text-stone-800 mt-0.5">{formatCurrency(totalCost)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-stone-400 uppercase tracking-wide">Total Paid</p>
          <p className="text-base font-semibold text-emerald-600 mt-0.5">{formatCurrency(totalPaid)}</p>
        </div>
        <div className={`p-3 text-center border-l-4 ${balance > 0.01 ? "border-l-red-400" : balance < -0.01 ? "border-l-emerald-400" : "border-l-stone-200"}`}>
          <p className="text-[10px] text-stone-400 uppercase tracking-wide">Balance</p>
          <p className={`text-base font-semibold mt-0.5 ${balance > 0.01 ? "text-[#0d3d3b]" : balance < -0.01 ? "text-emerald-600" : "text-stone-400"}`}>
            {balance > 0.01 ? `−${formatCurrency(balance)}` : balance < -0.01 ? `+${formatCurrency(Math.abs(balance))}` : "Settled"}
          </p>
          <p className="text-[10px] text-stone-400">
            {balance > 0.01 ? "You owe" : balance < -0.01 ? "Overpaid" : ""}
          </p>
        </div>
      </div>

      {/* Add Payment Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="p-4 border-b border-stone-200 bg-[#0d9488]/50">
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-3">New Payment</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Amount (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={form.amountUsd}
                onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={form.paymentDate}
                onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Reference</label>
              <input
                type="text"
                placeholder="Wire ref, check #..."
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Notes</label>
              <input
                type="text"
                placeholder="Optional note"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium bg-[#0d3d3b] text-white rounded-md hover:bg-[#0a2e2c] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Payment"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm font-medium bg-stone-100 text-stone-600 rounded-md hover:bg-stone-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Payments Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500">Date</th>
              <th className="text-right px-4 py-2.5 font-medium text-stone-500">Amount</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500">Reference</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500">Notes</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-stone-400 text-sm">
                  No payments recorded for this PO yet.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-2.5 text-stone-700">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-stone-900">{formatCurrency(p.amountUsd)}</td>
                <td className="px-4 py-2.5 text-stone-600">{p.reference || "—"}</td>
                <td className="px-4 py-2.5 text-stone-400">{p.notes || "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="text-xs text-[#0d3d3b] hover:text-[#0d3d3b] disabled:opacity-50 transition-colors"
                  >
                    {deleting === p.id ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                <td className="px-4 py-2.5 text-stone-700">TOTAL</td>
                <td className="px-4 py-2.5 text-right text-stone-900">{formatCurrency(totalPaid)}</td>
                <td colSpan={3} className="px-4 py-2.5"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
