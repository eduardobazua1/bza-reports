"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatNumber, formatCurrency } from "@/lib/utils";

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

type OrderLine = { destination: string; tons: string; notes: string };

type SupplierOrder = {
  id: number;
  purchaseOrderId: number;
  orderDate: string | null;
  tons: number;
  pricePerTon: number | null;
  incoterm: string | null;
  item: string | null;
  lines: string | null;
  notes: string | null;
  createdAt: string;
};

type Product = { id: number; name: string };

function emptyLine(): OrderLine {
  return { destination: "", tons: "", notes: "" };
}

function parsedLinesToForm(linesJson: string | null): OrderLine[] {
  if (!linesJson) return [emptyLine()];
  try {
    const parsed = JSON.parse(linesJson) as { destination: string; tons: number; notes: string }[];
    if (!parsed.length) return [emptyLine()];
    return parsed.map(l => ({ destination: l.destination || "", tons: String(l.tons), notes: l.notes || "" }));
  } catch { return [emptyLine()]; }
}

export function SupplierOrdersSection({
  purchaseOrderId,
  supplierOrders,
  buyPrice,
  poTerms,
  poNumber,
  supplierEmail,
  product,
  products,
}: {
  purchaseOrderId: number;
  supplierOrders: SupplierOrder[];
  buyPrice: number;
  poTerms: string | null;
  poNumber: string;
  supplierEmail: string | null;
  supplierName: string;
  product?: string;
  products?: Product[];
}) {
  const [list, setList] = useState<SupplierOrder[]>(supplierOrders);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [attachmentsId, setAttachmentsId] = useState<number | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editIncoterm, setEditIncoterm] = useState("");
  const [editItem, setEditItem] = useState("");
  const [editLines, setEditLines] = useState<OrderLine[]>([emptyLine()]);
  const [editLoading, setEditLoading] = useState(false);

  // Add form state — pre-filled with PO defaults
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [pricePerTon, setPricePerTon] = useState(String(buyPrice));
  const [incoterm, setIncoterm] = useState(poTerms || "");
  const [addItem, setAddItem] = useState(product || "");
  const [lines, setLines] = useState<OrderLine[]>([emptyLine()]);

  const totalTons = list.reduce((s, o) => s + o.tons, 0);
  const formTotalTons = lines.reduce((s, l) => s + (parseFloat(l.tons) || 0), 0);
  const editTotalTons = editLines.reduce((s, l) => s + (parseFloat(l.tons) || 0), 0);

  function addLine() { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof OrderLine, value: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function addEditLine() { setEditLines((prev) => [...prev, emptyLine()]); }
  function removeEditLine(i: number) { setEditLines((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateEditLine(i: number, field: keyof OrderLine, value: string) {
    setEditLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function openEdit(order: SupplierOrder) {
    setEditingId(order.id);
    setEditDate(order.orderDate || "");
    setEditPrice(order.pricePerTon != null ? String(order.pricePerTon) : "");
    setEditIncoterm(order.incoterm || "");
    setEditItem(order.item || "");
    setEditLines(parsedLinesToForm(order.lines));
    setSendingId(null);
  }

  function cancelEdit() { setEditingId(null); }

  async function handleEdit(order: SupplierOrder) {
    const validLines = editLines.filter(l => l.tons && parseFloat(l.tons) > 0);
    if (validLines.length === 0) return;
    const totalT = validLines.reduce((s, l) => s + parseFloat(l.tons), 0);

    setEditLoading(true);
    const res = await fetch(`/api/supplier-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderDate: editDate || null,
        tons: totalT,
        pricePerTon: editPrice ? parseFloat(editPrice) : null,
        incoterm: editIncoterm || null,
        item: editItem || null,
        lines: validLines.map(l => ({ destination: l.destination, tons: parseFloat(l.tons), notes: l.notes })),
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setList((prev) => prev.map(o => o.id === order.id ? updated : o));
      setEditingId(null);
    }
    setEditLoading(false);
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
        item: addItem || null,
        lines: validLines.map(l => ({ destination: l.destination, tons: parseFloat(l.tons), notes: l.notes })),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setOrderDate(new Date().toISOString().split("T")[0]);
      setPricePerTon(String(buyPrice));
      setIncoterm(poTerms || "");
      setAddItem(product || "");
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
    setEditingId(null);
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
    const p = d.split("T")[0].split("-");
    return `${p[1].padStart(2,"0")}/${p[2].padStart(2,"0")}/${p[0]}`;
  }

  function parsedLines(order: SupplierOrder) {
    if (!order.lines) return null;
    try { return JSON.parse(order.lines) as { destination: string; tons: number; notes: string }[]; }
    catch { return null; }
  }

  const ProductSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-xs text-stone-500 mb-1">Product</label>
      {products && products.length > 0 ? (
        <select
          className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select product —</option>
          {products.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      ) : (
        <input
          className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
          placeholder="Product name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Supplier Orders ({list.length})</h3>
          <div className="flex items-center gap-3 mt-0.5">
            {product && (
              <p className="text-xs text-stone-500">{product}</p>
            )}
            {totalTons > 0 && (
              <p className="text-xs text-stone-400">{formatNumber(totalTons, 1)} TN ordered</p>
            )}
          </div>
        </div>
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              // Reset to PO defaults each time the form opens
              setOrderDate(new Date().toISOString().split("T")[0]);
              setPricePerTon(String(buyPrice));
              setIncoterm(poTerms || "");
              setAddItem(product || "");
              setLines([emptyLine()]);
            }}
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
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Product</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Tons</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Price/TN</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Incoterm</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Total</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Lines</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((order) => {
                const price = order.pricePerTon ?? buyPrice;
                const inc = order.incoterm ?? poTerms ?? "";
                const total = order.tons * price;
                const isSending = sendingId === order.id;
                const isEditing = editingId === order.id;
                const wasSent = sentId === order.id;
                const ol = parsedLines(order);

                return (
                  <>
                    <tr key={order.id} className={`hover:bg-stone-50 align-top ${isEditing ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3 border-t border-stone-100">{fmtDate(order.orderDate)}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-600">{order.item || "—"}</td>
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAttachmentsId(attachmentsId === order.id ? null : order.id)}
                            title="View PDF / Attachments"
                            className="text-stone-400 hover:text-stone-600 p-1 rounded hover:bg-stone-100"
                          >
                            <PaperclipIcon className="w-3.5 h-3.5" />
                          </button>
                          <div className="flex items-center gap-0">
                            <div ref={openDropdownId === order.id ? dropdownRef : undefined}>
                              <button
                                onClick={(e) => {
                                  if (openDropdownId === order.id) { setOpenDropdownId(null); return; }
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const estimatedH = 180;
                                  const spaceBelow = window.innerHeight - r.bottom;
                                  const top = spaceBelow < estimatedH ? r.top - estimatedH - 4 : r.bottom + 4;
                                  setDropdownPos({ top, right: window.innerWidth - r.right });
                                  setOpenDropdownId(order.id);
                                }}
                                className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors text-base leading-none"
                              >
                                ···
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>


                    {isSending && (
                      <tr key={`send-${order.id}`}>
                        <td colSpan={8} className="p-0">
                          <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex items-center gap-3">
                            <span className="text-xs text-[#0d9488] font-medium whitespace-nowrap">Send to:</span>
                            <input
                              type="email"
                              className="border border-blue-200 rounded px-2 py-1 text-sm flex-1 max-w-xs"
                              placeholder={supplierEmail || "supplier@example.com"}
                              value={sendEmail}
                              onChange={(e) => setSendEmail(e.target.value)}
                            />
                            <button onClick={() => handleSend(order)} disabled={sendLoading || !sendEmail} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium">
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Date</label>
              <input type="date" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <ProductSelect value={addItem} onChange={setAddItem} />
            <div>
              <label className="block text-xs text-stone-500 mb-1">Price/TN (USD)</label>
              <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="0.00" value={pricePerTon} onChange={(e) => setPricePerTon(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Incoterm</label>
              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="DAP, CIF, FOB..." value={incoterm} onChange={(e) => setIncoterm(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-500 uppercase">Lines</label>
              <button onClick={addLine} className="text-xs text-[#0d9488] hover:text-[#0d9488] font-medium">+ Add line</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_1fr_24px] gap-2 items-center">
                  <input className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="Destination (e.g. Morelia)" value={line.destination} onChange={(e) => updateLine(i, "destination", e.target.value)} />
                  <input type="number" step="0.1" className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="TN" value={line.tons} onChange={(e) => updateLine(i, "tons", e.target.value)} />
                  <input className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="Notes (e.g. 90 tons week 6-12)" value={line.notes} onChange={(e) => updateLine(i, "notes", e.target.value)} />
                  {lines.length > 1 && <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-sm text-center">✕</button>}
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
            <button onClick={handleAdd} disabled={loading || formTotalTons === 0} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setAdding(false); setLines([emptyLine()]); }} className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attachments / PDF modal */}
      {attachmentsId !== null && (() => {
        const order = list.find(o => o.id === attachmentsId);
        if (!order) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAttachmentsId(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-stone-700">Supplier PO — {fmtDate(order.orderDate)}</p>
                <button onClick={() => setAttachmentsId(null)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
              </div>
              <a
                href={`/api/supplier-po-pdf?poId=${purchaseOrderId}&soId=${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 hover:bg-stone-100 transition"
              >
                <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-stone-700">View Supplier PO PDF</span>
              </a>
            </div>
          </div>
        );
      })()}

      {/* Dropdown — portal-rendered to escape overflow containers */}
      {openDropdownId !== null && dropdownPos && (() => {
        const order = list.find(o => o.id === openDropdownId);
        if (!order) return null;
        const wasSent = sentId === order.id;
        const isEditing = editingId === order.id;
        return createPortal(
          <div ref={dropdownRef} style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }} className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[150px] py-1 text-left">
            <button onClick={() => { setOpenDropdownId(null); isEditing ? cancelEdit() : openEdit(order); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">View/Edit</button>
            <a href={`/api/supplier-po-pdf?poId=${purchaseOrderId}&soId=${order.id}`} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpenDropdownId(null)}>Print</a>
            {wasSent ? (
              <span className="block px-4 py-2 text-sm text-emerald-600 font-medium">Sent ✓</span>
            ) : (
              <button onClick={() => { setOpenDropdownId(null); openSend(order); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Send</button>
            )}
            <div className="border-t border-stone-100 my-1" />
            <button onClick={() => { setOpenDropdownId(null); handleDelete(order.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
          </div>,
          document.body
        );
      })()}

      {/* Edit modal — fixed overlay, no layout shift */}
      {editingId !== null && (() => {
        const order = list.find(o => o.id === editingId);
        if (!order) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-700">Edit Supplier Order</p>
                <button onClick={cancelEdit} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Date</label>
                  <input type="date" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <ProductSelect value={editItem} onChange={setEditItem} />
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Price/TN (USD)</label>
                  <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder={String(buyPrice)} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Incoterm</label>
                  <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="DAP, CIF, FOB..." value={editIncoterm} onChange={(e) => setEditIncoterm(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-stone-500 uppercase">Lines</label>
                  <button onClick={addEditLine} className="text-xs text-amber-700 hover:text-amber-900 font-medium">+ Add line</button>
                </div>
                <div className="space-y-2">
                  {editLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_1fr_24px] gap-2 items-center">
                      <input className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="Destination" value={line.destination} onChange={(e) => updateEditLine(i, "destination", e.target.value)} />
                      <input type="number" step="0.1" className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="TN" value={line.tons} onChange={(e) => updateEditLine(i, "tons", e.target.value)} />
                      <input className="border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="Notes" value={line.notes} onChange={(e) => updateEditLine(i, "notes", e.target.value)} />
                      {editLines.length > 1 && <button onClick={() => removeEditLine(i)} className="text-red-400 hover:text-red-600 text-sm text-center">✕</button>}
                    </div>
                  ))}
                </div>
                {editTotalTons > 0 && (
                  <p className="text-xs text-stone-500 mt-2">Total: {formatNumber(editTotalTons, 1)} TN · {formatCurrency(editTotalTons * (editPrice ? parseFloat(editPrice) : buyPrice))}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => handleEdit(order)} disabled={editLoading || editTotalTons === 0} className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50 font-medium">
                  {editLoading ? "Saving..." : "Save changes"}
                </button>
                <button onClick={cancelEdit} className="text-sm text-stone-500 hover:text-stone-700 px-4 py-1.5">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
