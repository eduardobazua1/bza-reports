"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatNumber, formatCurrency } from "@/lib/utils";

type ClientPO = {
  id: number;
  purchaseOrderId: number;
  clientPoNumber: string;
  destination: string | null;
  plannedTons: number | null;
  item: string | null;
  incoterm: string | null;
  sellPriceOverride: number | null;
  status: "pending" | "partial" | "complete";
  notes: string | null;
  createdAt: string;
};

type ConvertForm = {
  invoiceNumber: string;
  vehicleId: string;
  blNumber: string;
  shipmentDate: string;
  invoiceDate: string;
  quantityTons: string;
  balesCount: string;
  unitsPerBale: string;
  item: string;
  sellPriceOverride: string;
};

type Product = { id: number; name: string };

export function ClientPOsSection({
  purchaseOrderId,
  clientPos,
  poNumber,
  sellPrice,
  poTerms,
  product,
  products,
}: {
  purchaseOrderId: number;
  clientPos: ClientPO[];
  poNumber?: string;
  sellPrice?: number;
  poTerms?: string | null;
  product?: string;
  products?: Product[];
}) {
  const [list, setList] = useState<ClientPO[]>(clientPos);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [dropdownInvoiceCounter, setDropdownInvoiceCounter] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    clientPoNumber: "",
    destination: "",
    plannedTons: "",
    item: "",
    incoterm: "",
    sellPriceOverride: "",
  });
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    invoiceNumber: "",
    vehicleId: "",
    blNumber: "",
    shipmentDate: new Date().toISOString().split("T")[0],
    invoiceDate: new Date().toISOString().split("T")[0],
    quantityTons: "",
    balesCount: "",
    unitsPerBale: "",
    item: product || "",
    sellPriceOverride: "",
  });
  const [addForm, setAddForm] = useState({
    clientPoNumber: "",
    destination: "",
    plannedTons: "",
    item: product || "",
    incoterm: poTerms || "",
    sellPriceOverride: sellPrice ? String(sellPrice) : "",
  });

  const totalPlanned = list.reduce((s, p) => s + (p.plannedTons || 0), 0);
  const totalAmount = sellPrice
    ? list.reduce((s, p) => s + (p.plannedTons || 0) * (p.sellPriceOverride ?? sellPrice), 0)
    : 0;

  function suggestInvoiceNumber(invoiceCount: number) {
    if (!poNumber) return "";
    const base = poNumber.replace("X", "IX");
    return `${base}-${invoiceCount + 1}`;
  }

  // When "Convert to Invoice" is clicked, pre-fill from the client order's stored fields
  function openConvert(cpo: ClientPO, invoiceCount: number) {
    setConvertingId(cpo.id);
    setConvertForm({
      invoiceNumber: suggestInvoiceNumber(invoiceCount),
      vehicleId: "",
      blNumber: "",
      shipmentDate: new Date().toISOString().split("T")[0],
      invoiceDate: new Date().toISOString().split("T")[0],
      quantityTons: cpo.plannedTons?.toString() || "",
      balesCount: "",
      unitsPerBale: "",
      item: cpo.item || product || "",
      sellPriceOverride: cpo.sellPriceOverride != null ? String(cpo.sellPriceOverride) : "",
    });
  }

  async function handleConvert(cpo: ClientPO) {
    if (!convertForm.quantityTons || !convertForm.invoiceNumber) return;
    setConvertLoading(true);
    const effectivePrice = convertForm.sellPriceOverride ? parseFloat(convertForm.sellPriceOverride) : null;
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        invoiceNumber: convertForm.invoiceNumber,
        salesDocument: cpo.clientPoNumber,
        destination: cpo.destination,
        vehicleId: convertForm.vehicleId || null,
        blNumber: convertForm.blNumber || null,
        shipmentDate: convertForm.shipmentDate || null,
        invoiceDate: convertForm.invoiceDate || null,
        quantityTons: parseFloat(convertForm.quantityTons),
        item: convertForm.item || null,
        shipmentStatus: "programado",
        balesCount: convertForm.balesCount ? parseInt(convertForm.balesCount) : null,
        unitsPerBale: convertForm.unitsPerBale ? parseInt(convertForm.unitsPerBale) : null,
        sellPriceOverride: effectivePrice,
      }),
    });

    if (res.ok) {
      await fetch(`/api/client-pos/${cpo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "partial" }),
      });
      setList((prev) => prev.map((p) => (p.id === cpo.id ? { ...p, status: "partial" } : p)));
      setConvertingId(null);
      window.location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error creating invoice");
    }
    setConvertLoading(false);
  }

  async function handleAdd() {
    if (!addForm.clientPoNumber) return;
    setLoading(true);
    const res = await fetch("/api/client-pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        clientPoNumber: addForm.clientPoNumber,
        destination: addForm.destination || null,
        plannedTons: addForm.plannedTons ? parseFloat(addForm.plannedTons) : null,
        item: addForm.item || null,
        incoterm: addForm.incoterm || null,
        sellPriceOverride: addForm.sellPriceOverride ? parseFloat(addForm.sellPriceOverride) : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setAddForm({ clientPoNumber: "", destination: "", plannedTons: "", item: product || "", incoterm: poTerms || "", sellPriceOverride: sellPrice ? String(sellPrice) : "" });
      setAdding(false);
    }
    setLoading(false);
  }

  function openEdit(cpo: ClientPO) {
    setEditingId(cpo.id);
    setConvertingId(null);
    setEditForm({
      clientPoNumber: cpo.clientPoNumber,
      destination: cpo.destination || "",
      plannedTons: cpo.plannedTons != null ? String(cpo.plannedTons) : "",
      item: cpo.item || "",
      incoterm: cpo.incoterm || "",
      sellPriceOverride: cpo.sellPriceOverride != null ? String(cpo.sellPriceOverride) : "",
    });
  }

  function cancelEdit() { setEditingId(null); }

  async function handleEdit(cpo: ClientPO) {
    setEditLoading(true);
    const res = await fetch(`/api/client-pos/${cpo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientPoNumber: editForm.clientPoNumber,
        destination: editForm.destination || null,
        plannedTons: editForm.plannedTons ? parseFloat(editForm.plannedTons) : null,
        item: editForm.item || null,
        incoterm: editForm.incoterm || null,
        sellPriceOverride: editForm.sellPriceOverride ? parseFloat(editForm.sellPriceOverride) : null,
      }),
    });
    if (res.ok) {
      setList((prev) => prev.map((p) =>
        p.id === cpo.id ? {
          ...p,
          clientPoNumber: editForm.clientPoNumber,
          destination: editForm.destination || null,
          plannedTons: editForm.plannedTons ? parseFloat(editForm.plannedTons) : null,
          item: editForm.item || null,
          incoterm: editForm.incoterm || null,
          sellPriceOverride: editForm.sellPriceOverride ? parseFloat(editForm.sellPriceOverride) : null,
        } : p
      ));
      setEditingId(null);
    }
    setEditLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this Client PO?")) return;
    await fetch(`/api/client-pos/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((p) => p.id !== id));
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    partial: "bg-blue-100 text-blue-700",
    complete: "bg-emerald-100 text-emerald-700",
  };
  const statusLabels: Record<string, string> = {
    pending: "Pending",
    partial: "Partial",
    complete: "Complete",
  };

  let invoiceCounter = 0;

  // Reusable product selector
  function ProductSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return products && products.length > 0 ? (
      <select
        className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select product —</option>
        {products.map((p) => (
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
    );
  }

  return (
    <div className="bg-white rounded-md shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Client Orders ({list.length})</h3>
          <div className="flex items-center gap-3 mt-0.5">
            {totalPlanned > 0 && (
              <p className="text-xs text-stone-400">
                {formatNumber(totalPlanned, 1)} TN planned
                {totalAmount > 0 && ` · ${formatCurrency(totalAmount)} estimated`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            // Reset to PO defaults each time the form opens
            setAddForm({
              clientPoNumber: "",
              destination: "",
              plannedTons: "",
              item: product || "",
              incoterm: poTerms || "",
              sellPriceOverride: sellPrice ? String(sellPrice) : "",
            });
            setAdding(true);
          }}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition"
        >
          + Add Order
        </button>
      </div>

      {list.length === 0 && !adding && (
        <p className="p-6 text-center text-stone-400 text-sm">
          No client orders yet. Add orders before creating invoices.
        </p>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Client PO</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Product</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Destination</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Incoterm</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Tons</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Price/TN</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Est. Amount</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Status</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((cpo) => {
                const effectivePrice = cpo.sellPriceOverride ?? sellPrice;
                const amount = effectivePrice && cpo.plannedTons ? cpo.plannedTons * effectivePrice : null;
                const isConverting = convertingId === cpo.id;
                invoiceCounter++;

                return (
                  <>
                    <tr key={cpo.id} className={`hover:bg-stone-50 ${editingId === cpo.id ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3 border-t border-stone-100 font-mono text-xs font-semibold text-[#0d3d3b]">
                        {cpo.clientPoNumber}
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-600 text-xs">{cpo.item || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-500">{cpo.destination || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-stone-500 text-xs">{cpo.incoterm || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">
                        {cpo.plannedTons ? formatNumber(cpo.plannedTons, 1) : "—"}
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right text-xs text-stone-500">
                        {cpo.sellPriceOverride ? formatCurrency(cpo.sellPriceOverride) : (sellPrice ? formatCurrency(sellPrice) : "—")}
                        {cpo.sellPriceOverride && <span className="ml-1 text-amber-500">*</span>}
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right font-medium">
                        {amount ? formatCurrency(amount) : "—"}
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[cpo.status]}`}>
                          {statusLabels[cpo.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">
                        <div className="flex items-center justify-end gap-0">
                          <div ref={openDropdownId === cpo.id ? dropdownRef : undefined}>
                            <button
                              onClick={(e) => {
                                if (openDropdownId === cpo.id) { setOpenDropdownId(null); return; }
                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const estimatedH = 180;
                                const spaceBelow = window.innerHeight - r.bottom;
                                const top = spaceBelow < estimatedH ? r.top - estimatedH - 4 : r.bottom + 4;
                                setDropdownPos({ top, right: window.innerWidth - r.right });
                                setDropdownInvoiceCounter(invoiceCounter - 1);
                                setOpenDropdownId(cpo.id);
                              }}
                              className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors text-base leading-none"
                            >
                              ···
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>


                    {/* Convert to Invoice inline form */}
                    {isConverting && (
                      <tr key={`convert-${cpo.id}`}>
                        <td colSpan={9} className="p-0">
                          <div className="bg-emerald-50 border-t border-emerald-200 p-4 space-y-3">
                            <p className="text-xs font-semibold text-emerald-800 uppercase">
                              New Invoice — {cpo.clientPoNumber} · {cpo.destination}
                            </p>

                            {/* Row 1: key fields pre-filled from client order */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Invoice # *</label>
                                <input
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                                  value={convertForm.invoiceNumber}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Product</label>
                                <ProductSelect
                                  value={convertForm.item}
                                  onChange={(v) => setConvertForm((f) => ({ ...f, item: v }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Tons ADMT *</label>
                                <input
                                  type="number" step="0.001"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  value={convertForm.quantityTons}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, quantityTons: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Sell Price/TN</label>
                                <input
                                  type="number" step="0.01"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  placeholder={`${sellPrice ?? ""} (default)`}
                                  value={convertForm.sellPriceOverride}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, sellPriceOverride: e.target.value }))}
                                />
                              </div>
                            </div>

                            {/* Row 2: shipment details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Railcar #</label>
                                <input
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                                  placeholder="TBOX636255"
                                  value={convertForm.vehicleId}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, vehicleId: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">BOL #</label>
                                <input
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                                  placeholder="4001124"
                                  value={convertForm.blNumber}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, blNumber: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Ship Date</label>
                                <input
                                  type="date"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  value={convertForm.shipmentDate}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, shipmentDate: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Invoice Date</label>
                                <input
                                  type="date"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  value={convertForm.invoiceDate}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 max-w-xs">
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Bales</label>
                                <input type="number" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="250" value={convertForm.balesCount} onChange={(e) => setConvertForm((f) => ({ ...f, balesCount: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Units/Bale</label>
                                <input type="number" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="1" value={convertForm.unitsPerBale} onChange={(e) => setConvertForm((f) => ({ ...f, unitsPerBale: e.target.value }))} />
                              </div>
                            </div>

                            {/* Amount preview */}
                            {convertForm.quantityTons && (
                              <div className="text-sm text-emerald-800 font-medium">
                                Invoice total: {formatCurrency(
                                  parseFloat(convertForm.quantityTons) * (convertForm.sellPriceOverride ? parseFloat(convertForm.sellPriceOverride) : (sellPrice ?? 0))
                                )}
                                {" "}({convertForm.quantityTons} TN × ${convertForm.sellPriceOverride || sellPrice}/TN)
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleConvert(cpo)}
                                disabled={convertLoading || !convertForm.invoiceNumber || !convertForm.quantityTons}
                                className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
                              >
                                {convertLoading ? "Creating..." : "Create Invoice"}
                              </button>
                              <button onClick={() => setConvertingId(null)} className="text-sm text-stone-500 hover:text-stone-700 px-3 py-1.5">
                                Cancel
                              </button>
                            </div>
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

      {/* Add new Client Order form */}
      {adding && (
        <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase">New Client Order</p>

          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Client PO # *</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                placeholder="X190165"
                value={addForm.clientPoNumber}
                onChange={(e) => setAddForm((f) => ({ ...f, clientPoNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Destination</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="Morelia, Ecatepec..."
                value={addForm.destination}
                onChange={(e) => setAddForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Planned Tons</label>
              <input
                type="number" step="0.1"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="270"
                value={addForm.plannedTons}
                onChange={(e) => setAddForm((f) => ({ ...f, plannedTons: e.target.value }))}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Product</label>
              <ProductSelect value={addForm.item} onChange={(v) => setAddForm((f) => ({ ...f, item: v }))} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Incoterm</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="DAP, CIF, FOB..."
                value={addForm.incoterm}
                onChange={(e) => setAddForm((f) => ({ ...f, incoterm: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Price/TN override</label>
              <input
                type="number" step="0.01"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder={sellPrice ? `${sellPrice} (default)` : "0.00"}
                value={addForm.sellPriceOverride}
                onChange={(e) => setAddForm((f) => ({ ...f, sellPriceOverride: e.target.value }))}
              />
            </div>
          </div>

          {addForm.plannedTons && (
            <p className="text-xs text-stone-500">
              Estimated: {formatCurrency(parseFloat(addForm.plannedTons) * (addForm.sellPriceOverride ? parseFloat(addForm.sellPriceOverride) : (sellPrice ?? 0)))}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !addForm.clientPoNumber}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dropdown — portal-rendered to escape overflow containers */}
      {openDropdownId !== null && dropdownPos && (() => {
        const cpo = list.find(o => o.id === openDropdownId);
        if (!cpo) return null;
        return createPortal(
          <div ref={dropdownRef} style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }} className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[150px] py-1 text-left">
            <button onClick={() => { setOpenDropdownId(null); openEdit(cpo); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">View/Edit</button>
            {cpo.status !== "complete" && (
              <button onClick={() => { setOpenDropdownId(null); openConvert(cpo, dropdownInvoiceCounter); }} className="w-full text-left px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 font-medium">Convert →</button>
            )}
            <div className="border-t border-stone-100 my-1" />
            <button onClick={() => { setOpenDropdownId(null); handleDelete(cpo.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
          </div>,
          document.body
        );
      })()}

      {/* Edit modal — fixed overlay, no layout shift */}
      {editingId !== null && (() => {
        const cpo = list.find(o => o.id === editingId);
        if (!cpo) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-700">Edit Client Order</p>
                <button onClick={cancelEdit} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Client PO # *</label>
                  <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono" value={editForm.clientPoNumber} onChange={(e) => setEditForm(f => ({ ...f, clientPoNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Destination</label>
                  <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="Morelia..." value={editForm.destination} onChange={(e) => setEditForm(f => ({ ...f, destination: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Planned Tons</label>
                  <input type="number" step="0.1" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.plannedTons} onChange={(e) => setEditForm(f => ({ ...f, plannedTons: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Product</label>
                  <ProductSelect value={editForm.item} onChange={(v) => setEditForm(f => ({ ...f, item: v }))} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Incoterm</label>
                  <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder="DAP, CIF, FOB..." value={editForm.incoterm} onChange={(e) => setEditForm(f => ({ ...f, incoterm: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Price/TN override</label>
                  <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" placeholder={sellPrice ? `${sellPrice} (default)` : "0.00"} value={editForm.sellPriceOverride} onChange={(e) => setEditForm(f => ({ ...f, sellPriceOverride: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleEdit(cpo)} disabled={editLoading || !editForm.clientPoNumber} className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50 font-medium">
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
