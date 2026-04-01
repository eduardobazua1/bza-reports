"use client";

import { useState, useTransition } from "react";
import { createSupplierPayment, deleteSupplierPayment } from "@/server/payment-actions";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: number;
  amountUsd: number;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  poNumber: string | null;
  invoiceNumber: string | null;
  tons?: number | null;
  pricePerTon?: number | null;
  estimatedTons?: number | null;
  actualTons?: number | null;
  actualAmount?: number | null;
  adjustmentAmount?: number | null;
  adjustmentStatus?: string | null;
};

type PO = { id: number; poNumber: string; clientName: string; totalCost: number; totalTons: number };

export function SupplierPaymentActions({
  supplierId, supplierName, payments, pos,
}: {
  supplierId: number;
  supplierName: string;
  payments: Payment[];
  pos: PO[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createSupplierPayment({
        supplierId,
        purchaseOrderId: fd.get("poId") ? Number(fd.get("poId")) : undefined,
        amountUsd: Number(fd.get("amount")),
        paymentDate: fd.get("date") as string,
        reference: (fd.get("reference") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      });
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this payment?")) return;
    startTransition(async () => {
      await deleteSupplierPayment(id);
      router.refresh();
    });
  }

  const total = payments.reduce((s, p) => s + p.amountUsd, 0);
  const shortName = supplierName.split("(")[0].trim();

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Payments to {shortName}</h3>
          <p className="text-xs text-stone-400 mt-0.5">Total recorded: {formatCurrency(total)}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0d3d3b] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#0a2e2d]"
          >
            + Record Payment
          </button>
        )}
      </div>

      {showForm && (
        <div className="p-4 border-b border-stone-100 bg-stone-50">
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Amount (USD) *</label>
              <input
                name="amount" type="number" step="0.01" required
                placeholder="297,000"
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Date *</label>
              <input
                name="date" type="date" required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">PO (optional)</label>
              <select name="poId" className="w-full border border-stone-200 rounded px-3 py-2 text-sm">
                <option value="">No specific PO</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} — {p.clientName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Reference / Notes</label>
              <input
                name="reference"
                placeholder="# wire / nota"
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <button
                type="submit" disabled={isPending}
                className="bg-[#0d3d3b] text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button" onClick={() => setShowForm(false)}
                className="border border-stone-200 px-4 py-2 rounded text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-stone-500">Date</th>
              <th className="text-right px-4 py-2 font-medium text-stone-500">Amount</th>
              <th className="text-left px-4 py-2 font-medium text-stone-500">PO</th>
              <th className="text-left px-4 py-2 font-medium text-stone-500">Reference / Notes</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-stone-400">
                  No payments recorded.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(p.amountUsd)}</td>
                <td className="px-4 py-2 font-mono text-xs text-stone-500">{p.poNumber || "-"}</td>
                <td className="px-4 py-2 text-stone-500 text-xs">{p.reference || p.notes || "-"}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                <td className="px-4 py-2">TOTAL</td>
                <td className="px-4 py-2 text-right">{formatCurrency(total)}</td>
                <td colSpan={3} className="px-4 py-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
