"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Trash2, Paperclip, Upload, ExternalLink } from "lucide-react";

type SupplierInvoice = {
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
  fileSize: number | null;
  paymentStatus: string;
  createdAt: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SupplierInvoicesSection({
  purchaseOrderId,
  supplierId,
  initialInvoices,
}: {
  purchaseOrderId: number;
  supplierId: number;
  initialInvoices: SupplierInvoice[];
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    estimatedTons: "",
    amountUsd: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalTons = invoices.reduce((s, i) => s + (i.estimatedTons || 0), 0);
  const totalAmount = invoices.reduce((s, i) => s + (i.amountUsd || 0), 0);
  const unpaidCount = invoices.filter(i => i.paymentStatus === "unpaid").length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.invoiceNumber) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("purchaseOrderId", String(purchaseOrderId));
      fd.append("supplierId", String(supplierId));
      fd.append("invoiceNumber", form.invoiceNumber);
      if (form.invoiceDate) fd.append("invoiceDate", form.invoiceDate);
      if (form.estimatedTons) fd.append("estimatedTons", form.estimatedTons);
      if (form.amountUsd) fd.append("amountUsd", form.amountUsd);
      if (form.notes) fd.append("notes", form.notes);
      if (file) fd.append("file", file);

      const res = await fetch("/api/supplier-invoices", { method: "POST", body: fd });
      if (res.ok) {
        const created = await res.json();
        setInvoices(prev => [...prev, created]);
        setShowAdd(false);
        setForm({ invoiceNumber: "", invoiceDate: "", estimatedTons: "", amountUsd: "", notes: "" });
        setFile(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this supplier invoice?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/supplier-invoices/${id}`, { method: "DELETE" });
      setInvoices(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePaid(inv: SupplierInvoice) {
    const next = inv.paymentStatus === "paid" ? "unpaid" : "paid";
    await fetch(`/api/supplier-invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: next }),
    });
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, paymentStatus: next } : i));
  }

  return (
    <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-amber-500">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">
            Supplier Invoices ({invoices.length})
          </h3>
          {invoices.length > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">
              {formatNumber(totalTons, 3)} TN · {formatCurrency(totalAmount)}
              {unpaidCount > 0 && <span className="ml-2 text-amber-600 font-medium">{unpaidCount} unpaid</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          {showAdd ? "Cancel" : "+ Add Factura"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="px-4 py-4 border-b border-stone-100 bg-stone-50 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Invoice # *</label>
              <input
                required
                value={form.invoiceNumber}
                onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                placeholder="e.g. CPP-2026-001"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Invoice Date</label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Tons</label>
              <input
                type="number" step="0.001" min="0"
                value={form.estimatedTons}
                onChange={e => setForm(f => ({ ...f, estimatedTons: e.target.value }))}
                placeholder="0.000"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Amount (USD)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.amountUsd}
                onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Notes</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#0d3d3b] mb-1 font-medium">Attach PDF (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-600 hover:bg-stone-100 bg-white"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {file ? file.name : "Choose file"}
                </button>
                {file && (
                  <button type="button" onClick={() => setFile(null)} className="text-xs text-stone-400 hover:text-stone-600">×</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.invoiceNumber}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Factura"}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {invoices.length === 0 && !showAdd ? (
        <div className="px-4 py-6 text-center text-sm text-stone-400">
          No supplier invoices recorded. Click "+ Add Factura" to start tracking.
        </div>
      ) : invoices.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Tons</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Notes</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-xs font-medium text-[#0d3d3b]">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-600">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-4 py-2.5 text-xs text-right text-stone-700">{inv.estimatedTons ? formatNumber(inv.estimatedTons, 3) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-semibold text-stone-800">{inv.amountUsd ? formatCurrency(inv.amountUsd) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-400">{inv.notes || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {inv.fileUrl ? (
                      <a
                        href={inv.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[#0d3d3b] hover:underline"
                        title={inv.fileName || ""}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{inv.fileName}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <button
                      onClick={() => togglePaid(inv)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                        inv.paymentStatus === "paid"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      {inv.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-right">
                    <button
                      onClick={() => handleDelete(inv.id)}
                      disabled={deletingId === inv.id}
                      className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      {deletingId === inv.id ? "…" : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {invoices.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                  <td colSpan={2} className="px-4 py-2 text-xs text-stone-600">TOTAL</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-700">{formatNumber(totalTons, 3)}</td>
                  <td className="px-4 py-2 text-xs text-right text-stone-800">{formatCurrency(totalAmount)}</td>
                  <td colSpan={4} className="px-4 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : null}
    </div>
  );
}
