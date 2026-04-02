"use client";

import { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

type OrderLine = { destination: string; tons: string; notes: string };

type SupplierOrder = {
  id: number;
  purchaseOrderId: number;
  orderDate: string | null;
  tons: number;
  pricePerTon: number | null;
  incoterm: string | null;
  lines: string | null;
  notes: string | null;
  createdAt: string;
};

function emptyLine(): OrderLine {
  return { destination: "", tons: "", notes: "" };
}

export function SupplierOrdersSection({
  purchaseOrderId,
  supplierOrders,
  buyPrice,
  poTerms,
  poNumber,
  supplierEmail,
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

  // Form state
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [pricePerTon, setPricePerTon] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([emptyLine()]);

  const totalTons = list.reduce((s, o) => s + o.tons, 0);
  const formTotalTons = lines.reduce((s, l) => s + (parseFloat(l.tons) || 0), 0);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof OrderLine, value: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  async function handleAdd() {
    const validLines = lines.filter(l => l.tons && parseFloat(l.tons) > 0);
    if (validLines.length === 0) return;
    const totalT = validLines.reduce((s, l) => s + parseFloat(l.tons), 0);

    setLoading(true);
    const res = await fetch("/api/supplier-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        orderDate: orderDate || null,
        tons: totalT,
        pricePerTon: pricePerTon ? parseFloat(pricePerTon) : null,
        incoterm: incoterm || null,
        lines: validLines.map(l => ({ destination: l.destination, tons: parseFloat(l.tons), notes: l.notes })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setOrderDate(new Date().toISOString().split("T")[0]);
      setPricePerTon("");
      setIncoterm("");
      setLines([emptyLine()]);
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

  function parsedLines(order: SupplierOrder) {
    if (!order.lines) return null;
    try { return JSON.parse(order.lines) as { destination: string; tons: number; notes: string }[]; }
    catch { return null; }
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
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
          >
            + New Order to Supplier
          </button>
        )}
      </div>

      {list.length === 0 && !adding && (
        <p className="p-6 text-center text-stone-400 text-sm">No supplier orders yet.</p>
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
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Lines</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => {
                const price = order.pricePerTon ?? buyPrice;
                const inc = order.incoterm ?? poTerms ?? "";
                const total = order.tons * price;
                const isSending = sendingId === order.id;
                const wasSent = sentId === order.id;
                const ol = parsedLines(order);

                return (
                  <>
                    <tr key={order.id} className="hover:bg-stone-50 align-top">
                      <td className="px-4 py-3 border-t border-stone-100">{fmtDate(order.orderDate)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right font-medium">{formatNumber(order.tons, 1)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">{formatCurrency(price)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-500">{inc || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right font-semibold">{formatCurrency(total)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-xs text-stone-500 space-y-0.5">
                        {ol && ol.length > 0 ? ol.map((l, i) => (
                          <div key={i}>
                            <span className="font-medium text-stone-700">{l.destination || "—"}</span>
                            {" "}{formatNumber(l.tons, 1)} TN
                            {l.notes && <span className="text-stone-400"> · {l.notes}</span>}
                          </div>
                        )) : "—"}
                      </td>
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
                          <button onClick={() => handleDelete(order.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
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
                            <button onClick={() => setSendingId(null)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
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

      {/* Add form */}
      {adding && (
        <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-4">
          <p className="text-xs font-semibold text-stone-500 uppercase">New Supplier Order — {poNumber}</p>

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Date</label>
              <input
                type="date"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Price/TN (USD)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder={buyPrice.toFixed(2)}
                value={pricePerTon}
                onChange={(e) => setPricePerTon(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Incoterm</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder={poTerms || "DAP, CIF, FOB..."}
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-500 uppercase">Lines</label>
              <button
                onClick={addLine}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_1fr_24px] gap-2 items-center">
                  <input
                    className="border border-stone-200 rounded px-2 py-1.5 text-sm"
                    placeholder="Destination (e.g. Morelia)"
                    value={line.destination}
                    onChange={(e) => updateLine(i, "destination", e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.1"
                    className="border border-stone-200 rounded px-2 py-1.5 text-sm"
                    placeholder="TN"
                    value={line.tons}
                    onChange={(e) => updateLine(i, "tons", e.target.value)}
                  />
                  <input
                    className="border border-stone-200 rounded px-2 py-1.5 text-sm"
                    placeholder="Notes (e.g. 90 tons week 6-12)"
                    value={line.notes}
                    onChange={(e) => updateLine(i, "notes", e.target.value)}
                  />
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-sm text-center">✕</button>
                  )}
                </div>
              ))}
            </div>
            {formTotalTons > 0 && (
              <p className="text-xs text-stone-500 mt-2">
                Total: {formatNumber(formTotalTons, 1)} TN · {formatCurrency(formTotalTons * (pricePerTon ? parseFloat(pricePerTon) : buyPrice))}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || formTotalTons === 0}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setAdding(false); setLines([emptyLine()]); }}
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
