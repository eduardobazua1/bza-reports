"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, X, CheckCircle, Ban, Trash2, Pencil } from "lucide-react";
import {
  createCreditMemo,
  updateCreditMemo,
  applyCreditMemo,
  voidCreditMemo,
  deleteCreditMemo,
} from "@/server/actions";

// ─── Types ────────────────────────────────────────────────────────────────────
export type CreditMemo = {
  id: number;
  clientId: number;
  clientName: string | null;
  invoiceId: number | null;
  creditNumber: string | null;
  amount: number;
  memoDate: string;
  reason: string | null;
  status: "open" | "applied" | "void";
  appliedDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type ClientOption = { id: number; name: string };
export type InvoiceOption = { id: number; invoiceNumber: string; clientId: number; amount: number };

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CreditMemo["status"] }) {
  const map = {
    open:    "bg-teal-50 text-teal-700 ring-teal-200",
    applied: "bg-stone-100 text-stone-600 ring-stone-200",
    void:    "bg-red-50 text-red-500 ring-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Memo form (create / edit) ────────────────────────────────────────────────
function MemoForm({
  memo,
  clients,
  invoices,
  onClose,
}: {
  memo?: CreditMemo;
  clients: ClientOption[];
  invoices: InvoiceOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().split("T")[0];

  const [clientId, setClientId] = useState(memo?.clientId ? String(memo.clientId) : "");
  const [invoiceId, setInvoiceId] = useState(memo?.invoiceId ? String(memo.invoiceId) : "");
  const [creditNumber, setCreditNumber] = useState(memo?.creditNumber ?? "");
  const [amount, setAmount] = useState(memo?.amount ? String(memo.amount) : "");
  const [memoDate, setMemoDate] = useState(memo?.memoDate ?? today);
  const [reason, setReason] = useState(memo?.reason ?? "");
  const [notes, setNotes] = useState(memo?.notes ?? "");

  // Filter invoices by selected client
  const clientInvoices = invoices.filter(i => i.clientId === Number(clientId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      clientId: Number(clientId),
      invoiceId: invoiceId ? Number(invoiceId) : null,
      creditNumber: creditNumber || undefined,
      amount: Number(amount),
      memoDate,
      reason: reason || undefined,
      notes: notes || undefined,
    };
    startTransition(async () => {
      if (memo) {
        await updateCreditMemo(memo.id, data);
      } else {
        await createCreditMemo(data);
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-stone-800">
            {memo ? "Edit" : "New Credit Memo"}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Client <span className="text-red-500">*</span></label>
            <select
              required
              value={clientId}
              onChange={e => { setClientId(e.target.value); setInvoiceId(""); }}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
            >
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Linked invoice (optional) */}
          {clientInvoices.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Linked Invoice (optional)</label>
              <select
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              >
                <option value="">None</option>
                {clientInvoices.map(i => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber} — {formatCurrency(i.amount)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Credit # and Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Credit #</label>
              <input
                value={creditNumber}
                onChange={e => setCreditNumber(e.target.value)}
                placeholder="CM-001"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                required
                type="date"
                value={memoDate}
                onChange={e => setMemoDate(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Amount (USD) <span className="text-red-500">*</span></label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Price adjustment, returned goods, etc."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 text-sm bg-[#0d3d3b] text-white rounded-lg hover:bg-[#0a5c5a] disabled:opacity-50">
              {pending ? "Saving…" : memo ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function CreditMemosPanel({
  memos,
  clients,
  invoices,
}: {
  memos: CreditMemo[];
  clients: ClientOption[];
  invoices: InvoiceOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editMemo, setEditMemo] = useState<CreditMemo | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "applied" | "void">("all");

  const filtered = memos.filter(m => filterStatus === "all" || m.status === filterStatus);
  const totalOpen   = memos.filter(m => m.status === "open").reduce((s, m) => s + m.amount, 0);
  const totalApplied = memos.filter(m => m.status === "applied").reduce((s, m) => s + m.amount, 0);

  function doAction(fn: () => Promise<void>) {
    startTransition(async () => { await fn(); router.refresh(); });
  }

  return (
    <>
      {/* Modals */}
      {showForm && (
        <MemoForm clients={clients} invoices={invoices} onClose={() => setShowForm(false)} />
      )}
      {editMemo && (
        <MemoForm memo={editMemo} clients={clients} invoices={invoices} onClose={() => setEditMemo(null)} />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Open Credits</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{formatCurrency(totalOpen)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{memos.filter(m => m.status === "open").length} memos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Applied</p>
          <p className="text-2xl font-bold text-stone-700 mt-1">{formatCurrency(totalApplied)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{memos.filter(m => m.status === "applied").length} memos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Total Issued</p>
          <p className="text-2xl font-bold text-stone-700 mt-1">{formatCurrency(memos.reduce((s, m) => s + m.amount, 0))}</p>
          <p className="text-xs text-stone-400 mt-0.5">{memos.length} total</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100">
          <div className="flex gap-1">
            {(["all", "open", "applied", "void"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-[#0d3d3b] text-white"
                    : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d3d3b] text-white rounded-lg text-xs font-medium hover:bg-[#0a5c5a] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New Credit Memo
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 text-sm">
            {filterStatus === "all" ? "No credit memos yet." : `No ${filterStatus} memos.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Credit #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Reason</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="px-5 py-3 text-stone-600 whitespace-nowrap">{formatDate(m.memoDate)}</td>
                    <td className="px-4 py-3 text-stone-700 font-medium">{m.creditNumber || <span className="text-stone-300">—</span>}</td>
                    <td className="px-4 py-3 text-stone-700">{m.clientName}</td>
                    <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">{m.reason || <span className="text-stone-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">{formatCurrency(m.amount)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {m.status === "open" && (
                          <>
                            <button
                              title="Edit"
                              onClick={() => setEditMemo(m)}
                              className="p-1.5 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Mark as Applied"
                              onClick={() => doAction(() => applyCreditMemo(m.id))}
                              disabled={isPending}
                              className="p-1.5 rounded-md text-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Void"
                              onClick={() => doAction(() => voidCreditMemo(m.id))}
                              disabled={isPending}
                              className="p-1.5 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          title="Delete"
                          onClick={() => {
                            if (confirm("Delete this credit memo?")) {
                              doAction(() => deleteCreditMemo(m.id));
                            }
                          }}
                          disabled={isPending}
                          className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
