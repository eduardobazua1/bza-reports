"use client";

import { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

type SupplierOrder = {
  id: number;
  purchaseOrderId: number;
  orderDate: string | null;
  tons: number;
  pricePerTon: number | null;
  incoterm: string | null;
  notes: string | null;
  createdAt: string;
};

export function SupplierOrdersSection({
  purchaseOrderId,
  supplierOrders,
  buyPrice,
  poTerms,
  poNumber,
  supplierEmail,
  supplierName,
}: {
  purchaseOrderId: number;
  supplierOrders: SupplierOrder[];
  buyPrice: number;
  poTerms: string | null;
  poNumber: string;
  supplierEmail: string | null;
  supplierName: string;
}) {
  const [list, setList] = useState<SupplierOrder[]>(supplierOrders);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [form, setForm] = useState({
    orderDate: new Date().toISOString().split("T")[0],
    tons: "",
    pricePerTon: "",
    incoterm: "",
    notes: "",
  });

  const totalTons = list.reduce((s, o) => s + o.tons, 0);

  async function handleAdd() {
    if (!form.tons) return;
    setLoading(true);
    const res = await fetch("/api/supplier-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        orderDate: form.orderDate || null,
        tons: parseFloat(form.tons),
        pricePerTon: form.pricePerTon ? parseFloat(form.pricePerTon) : null,
        incoterm: form.incoterm || null,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setForm({ orderDate: new Date().toISOString().split("T")[0], tons: "", pricePerTon: "", incoterm: "", notes: "" });
      setAdding(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this supplier order?")) return;
    await fetch(`/api/supplier-orders/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((o) => o.id !== id));
  }

  function openSend(order: SupplierOrder) {
    setSendingId(order.id);
    setSendEmail(supplierEmail || "");
    setSentId(null);
  }

  async function handleSend(order: SupplierOrder) {
    if (!sendEmail) return;
    setSendLoading(true);
    const res = await fetch("/api/supplier-po-pdf/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poId: purchaseOrderId, soId: order.id, to: sendEmail, poNumber }),
    });
    if (res.ok) {
      setSentId(order.id);
      setSendingId(null);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error sending email");
    }
    setSendLoading(false);
  }

  function fmtDate(d: string | null) {
    if (!d) return "—";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Supplier Orders ({list.length})</h3>
          {totalTons > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">{formatNumber(totalTons, 1)} TN total ordered</p>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
        >
          + New Order to Supplier
        </button>
      </div>

      {list.length === 0 && !adding && (
        <p className="p-6 text-center text-stone-400 text-sm">
          No supplier orders yet.
        </p>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Date</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Tons</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Price/TN</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Incoterm</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Total</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Notes</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500">PDF</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => {
                const price = order.pricePerTon ?? buyPrice;
                const incoterm = order.incoterm ?? poTerms ?? "";
                const total = order.tons * price;
                const isSending = sendingId === order.id;
                const wasSent = sentId === order.id;
                return (
                  <>
                    <tr key={order.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 border-t border-stone-100">{fmtDate(order.orderDate)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right font-medium">{formatNumber(order.tons, 1)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">{formatCurrency(price)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-500">{incoterm || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right font-semibold">{formatCurrency(total)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-400 text-xs">{order.notes || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <a
                            href={`/api/supplier-po-pdf?poId=${purchaseOrderId}&soId=${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            PDF
                          </a>
                          {wasSent ? (
                            <span className="text-xs text-emerald-600 font-medium">Sent ✓</span>
                          ) : (
                            <button
                              onClick={() => openSend(order)}
                              className="text-xs text-stone-500 hover:text-stone-700 font-medium"
                            >
                              Send
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(order.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isSending && (
                      <tr key={`send-${order.id}`}>
                        <td colSpan={7} className="p-0">
                          <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex items-center gap-3">
                            <span className="text-xs text-blue-700 font-medium whitespace-nowrap">Send to:</span>
                            <input
                              type="email"
                              className="border border-blue-200 rounded px-2 py-1 text-sm flex-1 max-w-xs"
                              placeholder={supplierEmail || "supplier@example.com"}
                              value={sendEmail}
                              onChange={(e) => setSendEmail(e.target.value)}
                            />
                            <button
                              onClick={() => handleSend(order)}
                              disabled={sendLoading || !sendEmail}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                            >
                              {sendLoading ? "Sending..." : "Send PDF"}
                            </button>
                            <button
                              onClick={() => setSendingId(null)}
                              className="text-xs text-stone-400 hover:text-stone-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase">New Supplier Order — {poNumber}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Date</label>
              <input
                type="date"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                value={form.orderDate}
                onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tons *</label>
              <input
                type="number"
                step="0.1"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="540"
                value={form.tons}
                onChange={(e) => setForm((f) => ({ ...f, tons: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Price/TN (USD) — blank = {formatCurrency(buyPrice)}</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder={buyPrice.toFixed(2)}
                value={form.pricePerTon}
                onChange={(e) => setForm((f) => ({ ...f, pricePerTon: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Incoterm — blank = {poTerms || "none"}</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder={poTerms || "DAP, CIF, FOB..."}
                value={form.incoterm}
                onChange={(e) => setForm((f) => ({ ...f, incoterm: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs text-stone-500 mb-1">Notes</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="e.g. Extra order for Ecatepec"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          {form.tons && (
            <p className="text-xs text-stone-500">
              Total: {formatCurrency(parseFloat(form.tons || "0") * (form.pricePerTon ? parseFloat(form.pricePerTon) : buyPrice))}
              {" "}({form.tons} TN × ${form.pricePerTon || buyPrice}/TN)
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !form.tons}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
