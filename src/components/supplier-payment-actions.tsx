"use client";

import { useState, useTransition } from "react";
import { createSupplierPayment, deleteSupplierPayment } from "@/server/payment-actions";
import { useRouter } from "next/navigation";

type Payment = {
  id: number; amountUsd: number; paymentDate: string;
  tons: number | null; pricePerTon: number | null;
  estimatedTons: number | null; actualTons: number | null;
  actualAmount: number | null; adjustmentAmount: number | null;
  adjustmentStatus: string | null;
  reference: string | null; notes: string | null;
  poNumber: string | null; invoiceNumber: string | null;
};
type PO = { id: number; poNumber: string; clientName: string; totalCost: number; totalTons: number };

export function SupplierPaymentActions({
  supplierId, supplierName, payments, pos,
}: {
  supplierId: number; supplierName: string; payments: Payment[]; pos: PO[];
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
        tons: fd.get("tons") ? Number(fd.get("tons")) : undefined,
        pricePerTon: fd.get("pricePerTon") ? Number(fd.get("pricePerTon")) : undefined,
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

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Payments to {supplierName}</h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
            + Record Payment
          </button>
        )}
      </div>

      {showForm && (
        <div className="p-4 border-b border-border bg-muted/30">
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Amount USD *</label>
              <input name="amount" type="number" step="0.01" required placeholder="679,000" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Estimated Tons</label>
              <input name="estimatedTons" type="number" step="0.001" placeholder="500" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price/TN</label>
              <input name="pricePerTon" type="number" step="0.01" placeholder="679" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">PO (optional)</label>
              <select name="poId" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="">No PO</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} — {p.clientName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reference</label>
              <input name="reference" placeholder="# wire / check" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <input name="notes" placeholder="E.g.: Dec advance, remaining" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {isPending ? "..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Payments list */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Paid</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Est. TN</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Actual TN</th>
              <th className="text-right p-3 font-medium text-muted-foreground">$/TN</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Adjustment</th>
              <th className="text-left p-3 font-medium text-muted-foreground">PO</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Notes</th>
              <th className="text-center p-3 font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No payments recorded.</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">{p.paymentDate}</td>
                <td className="p-3 text-right font-medium">${p.amountUsd.toLocaleString()}</td>
                <td className="p-3 text-right">{p.estimatedTons ? p.estimatedTons.toLocaleString() : p.tons ? p.tons.toLocaleString() : "-"}</td>
                <td className="p-3 text-right">{p.actualTons ? <span className="font-medium">{p.actualTons.toLocaleString()}</span> : <span className="text-muted-foreground">-</span>}</td>
                <td className="p-3 text-right">{p.pricePerTon ? `$${p.pricePerTon}` : "-"}</td>
                <td className="p-3 text-right">
                  {p.adjustmentAmount ? (
                    <span className={p.adjustmentAmount > 0 ? "text-green-600" : "text-red-600"}>
                      {p.adjustmentAmount > 0 ? "+" : ""}${Math.round(p.adjustmentAmount).toLocaleString()}
                    </span>
                  ) : "-"}
                </td>
                <td className="p-3">{p.poNumber || p.invoiceNumber || "-"}</td>
                <td className="p-3">{p.reference || "-"}</td>
                <td className="p-3 text-muted-foreground">{p.notes || "-"}</td>
                <td className="p-3 text-center">
                  <button onClick={() => handleDelete(p.id)} disabled={isPending} className="text-xs text-destructive hover:underline">×</button>
                </td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="bg-muted/50 font-bold border-t-2 border-border">
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right">${payments.reduce((s, p) => s + p.amountUsd, 0).toLocaleString()}</td>
                <td className="p-3 text-right">{payments.reduce((s, p) => s + (p.tons || 0), 0).toLocaleString()}</td>
                <td className="p-3" colSpan={5}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
