"use client";

import { useState } from "react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { DocumentUpload } from "@/components/document-upload";

type Invoice = {
  id: number;
  invoiceNumber: string;
  salesDocument: string | null;
  destination: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  shipmentDate: string | null;
  invoiceDate: string | null;
  quantityTons: number;
  item: string | null;
  balesCount: number | null;
  unitsPerBale: number | null;
  sellPriceOverride: number | null;
  buyPriceOverride: number | null;
  freightCost: number | null;
  shipmentStatus: string;
  customerPaymentStatus: string;
  notes: string | null;
};

type Product = { id: number; name: string };

const shipmentStatusLabels: Record<string, string> = {
  programado: "Scheduled",
  en_transito: "In Transit",
  en_aduana: "In Customs",
  entregado: "Delivered",
};
const shipmentStatusColors: Record<string, string> = {
  programado: "bg-amber-100 text-amber-700",
  en_transito: "bg-blue-100 text-blue-700",
  en_aduana: "bg-purple-100 text-purple-700",
  entregado: "bg-emerald-100 text-emerald-700",
};
const paymentStatusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-red-100 text-red-700",
};

export function InvoicesSection({
  invoices: initialInvoices,
  poSellPrice,
  poBuyPrice,
  products,
}: {
  invoices: Invoice[];
  poSellPrice: number;
  poBuyPrice: number;
  products: Product[];
}) {
  const [list, setList] = useState<Invoice[]>(initialInvoices);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Invoice> & { quantityTons: string; sellPriceOverride: string; buyPriceOverride: string; freightCost: string; balesCount: string; unitsPerBale: string }>({
    invoiceNumber: "",
    salesDocument: "",
    destination: "",
    vehicleId: "",
    blNumber: "",
    shipmentDate: "",
    invoiceDate: "",
    quantityTons: "",
    item: "",
    balesCount: "",
    unitsPerBale: "",
    sellPriceOverride: "",
    buyPriceOverride: "",
    freightCost: "",
    shipmentStatus: "programado",
    customerPaymentStatus: "unpaid",
    notes: "",
  });

  function openEdit(inv: Invoice) {
    setEditingId(inv.id);
    setEditForm({
      invoiceNumber: inv.invoiceNumber,
      salesDocument: inv.salesDocument || "",
      destination: inv.destination || "",
      vehicleId: inv.vehicleId || "",
      blNumber: inv.blNumber || "",
      shipmentDate: inv.shipmentDate || "",
      invoiceDate: inv.invoiceDate || "",
      quantityTons: String(inv.quantityTons),
      item: inv.item || "",
      balesCount: inv.balesCount != null ? String(inv.balesCount) : "",
      unitsPerBale: inv.unitsPerBale != null ? String(inv.unitsPerBale) : "",
      sellPriceOverride: inv.sellPriceOverride != null ? String(inv.sellPriceOverride) : "",
      buyPriceOverride: inv.buyPriceOverride != null ? String(inv.buyPriceOverride) : "",
      freightCost: inv.freightCost != null ? String(inv.freightCost) : "",
      shipmentStatus: inv.shipmentStatus,
      customerPaymentStatus: inv.customerPaymentStatus,
      notes: inv.notes || "",
    });
  }

  function cancelEdit() { setEditingId(null); }

  async function handleSave(inv: Invoice) {
    if (!editForm.invoiceNumber || !editForm.quantityTons) return;
    setEditLoading(true);
    const res = await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: editForm.invoiceNumber,
        salesDocument: editForm.salesDocument || null,
        destination: editForm.destination || null,
        vehicleId: editForm.vehicleId || null,
        blNumber: editForm.blNumber || null,
        shipmentDate: editForm.shipmentDate || null,
        invoiceDate: editForm.invoiceDate || null,
        quantityTons: parseFloat(editForm.quantityTons),
        item: editForm.item || null,
        balesCount: editForm.balesCount ? parseInt(editForm.balesCount) : null,
        unitsPerBale: editForm.unitsPerBale ? parseInt(editForm.unitsPerBale) : null,
        sellPriceOverride: editForm.sellPriceOverride ? parseFloat(editForm.sellPriceOverride) : null,
        buyPriceOverride: editForm.buyPriceOverride ? parseFloat(editForm.buyPriceOverride) : null,
        freightCost: editForm.freightCost ? parseFloat(editForm.freightCost) : null,
        shipmentStatus: editForm.shipmentStatus,
        customerPaymentStatus: editForm.customerPaymentStatus,
        notes: editForm.notes || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setList(prev => prev.map(i => i.id === inv.id ? updated : i));
      setEditingId(null);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error saving invoice");
    }
    setEditLoading(false);
  }

  function f(key: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setEditForm(p => ({ ...p, [key]: e.target.value })); }

  // Totals
  const totalTons = list.reduce((s, i) => s + i.quantityTons, 0);
  const totalRevenue = list.reduce((s, i) => s + i.quantityTons * (i.sellPriceOverride ?? poSellPrice), 0);
  const totalCostNoFreight = list.reduce((s, i) => s + i.quantityTons * (i.buyPriceOverride ?? poBuyPrice), 0);
  const totalProfit = totalRevenue - list.reduce((s, i) => s + i.quantityTons * (i.buyPriceOverride ?? poBuyPrice) + (i.freightCost || 0), 0);

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200">
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Invoices ({list.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Client PO</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Invoice #</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Product</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Destination</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Vehicle</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500">Tons</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500">Revenue</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500">Cost</th>
              <th className="text-right px-3 py-2 font-medium text-stone-500">Profit</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Ship Date</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Status</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Payment</th>
              <th className="text-left px-3 py-2 font-medium text-stone-500">Docs</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={14} className="p-6 text-center text-stone-400">No invoices for this PO.</td></tr>
            )}
            {list.map((inv) => {
              const sell = inv.sellPriceOverride ?? poSellPrice;
              const buy = inv.buyPriceOverride ?? poBuyPrice;
              const revenue = inv.quantityTons * sell;
              const cost = inv.quantityTons * buy + (inv.freightCost || 0);
              const profit = revenue - cost;
              const isEditing = editingId === inv.id;

              return (
                <>
                  <tr key={inv.id} className={`hover:bg-stone-50 align-middle ${isEditing ? "bg-amber-50/40" : ""}`}>
                    <td className="px-3 py-2 border-t border-stone-100 font-mono text-xs font-medium">{inv.salesDocument || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      {inv.invoiceNumber.startsWith("PEND-") ? (
                        <span className="text-xs text-amber-500 italic">Pending</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{inv.invoiceNumber}</span>
                          <a href={`/api/invoice-pdf?invoice=${inv.invoiceNumber}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">PDF</a>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-600 text-xs">{inv.item || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500">{inv.destination || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-stone-500 font-mono text-xs">{inv.vehicleId || "—"}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatNumber(inv.quantityTons, 3)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatCurrency(revenue)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">{formatCurrency(inv.quantityTons * buy)}</td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right font-medium">
                      <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(profit)}</span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">{formatDate(inv.shipmentDate)}</td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${shipmentStatusColors[inv.shipmentStatus] || ""}`}>
                        {shipmentStatusLabels[inv.shipmentStatus] || inv.shipmentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColors[inv.customerPaymentStatus] || ""}`}>
                        {inv.customerPaymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100">
                      <DocumentUpload invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
                    </td>
                    <td className="px-3 py-2 border-t border-stone-100 text-right">
                      <button
                        onClick={() => isEditing ? cancelEdit() : openEdit(inv)}
                        className={`text-xs font-medium ${isEditing ? "text-amber-600 hover:text-amber-800" : "text-stone-400 hover:text-stone-700"}`}
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                    </td>
                  </tr>

                  {/* Edit form */}
                  {isEditing && (
                    <tr key={`edit-${inv.id}`}>
                      <td colSpan={14} className="p-0">
                        <div className="bg-amber-50 border-t border-amber-200 p-4 space-y-4">
                          <p className="text-xs font-semibold text-amber-800 uppercase">Edit Invoice — {inv.invoiceNumber}</p>

                          {/* Row 1: identifiers */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Invoice # *</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono" value={editForm.invoiceNumber || ""} onChange={f("invoiceNumber")} />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Client PO</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono" value={editForm.salesDocument || ""} onChange={f("salesDocument")} placeholder="X190165" />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Product</label>
                              {products.length > 0 ? (
                                <select className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white" value={editForm.item || ""} onChange={f("item")}>
                                  <option value="">— Select —</option>
                                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                              ) : (
                                <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.item || ""} onChange={f("item")} placeholder="Product name" />
                              )}
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Destination</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.destination || ""} onChange={f("destination")} placeholder="Morelia" />
                            </div>
                          </div>

                          {/* Row 2: shipment */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Railcar #</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono" value={editForm.vehicleId || ""} onChange={f("vehicleId")} placeholder="TBOX636255" />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">BOL #</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono" value={editForm.blNumber || ""} onChange={f("blNumber")} placeholder="4001124" />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Ship Date</label>
                              <input type="date" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.shipmentDate || ""} onChange={f("shipmentDate")} />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Invoice Date</label>
                              <input type="date" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.invoiceDate || ""} onChange={f("invoiceDate")} />
                            </div>
                          </div>

                          {/* Row 3: quantities & prices */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Tons ADMT *</label>
                              <input type="number" step="0.001" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.quantityTons} onChange={f("quantityTons")} />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Bales</label>
                              <input type="number" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.balesCount || ""} onChange={f("balesCount")} placeholder="250" />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Units/Bale</label>
                              <input type="number" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.unitsPerBale || ""} onChange={f("unitsPerBale")} placeholder="1" />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Sell Price Override</label>
                              <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.sellPriceOverride || ""} onChange={f("sellPriceOverride")} placeholder={`${poSellPrice} (default)`} />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Buy Price Override</label>
                              <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.buyPriceOverride || ""} onChange={f("buyPriceOverride")} placeholder={`${poBuyPrice} (default)`} />
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Freight Cost</label>
                              <input type="number" step="0.01" className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.freightCost || ""} onChange={f("freightCost")} placeholder="0" />
                            </div>
                          </div>

                          {/* Row 4: statuses */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Shipment Status</label>
                              <select className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white" value={editForm.shipmentStatus || "programado"} onChange={f("shipmentStatus")}>
                                <option value="programado">Scheduled</option>
                                <option value="en_transito">In Transit</option>
                                <option value="en_aduana">In Customs</option>
                                <option value="entregado">Delivered</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Payment Status</label>
                              <select className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white" value={editForm.customerPaymentStatus || "unpaid"} onChange={f("customerPaymentStatus")}>
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-stone-500 mb-1">Notes</label>
                              <input className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm" value={editForm.notes || ""} onChange={f("notes")} placeholder="Optional notes" />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(inv)}
                              disabled={editLoading || !editForm.invoiceNumber || !editForm.quantityTons}
                              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50 font-medium"
                            >
                              {editLoading ? "Saving..." : "Save changes"}
                            </button>
                            <button onClick={cancelEdit} className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5">Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* Totals row */}
            {list.length > 0 && (
              <tr className="bg-stone-50 font-medium">
                <td colSpan={5} className="px-3 py-2 border-t border-stone-200 font-semibold">TOTAL</td>
                <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatNumber(totalTons, 3)}</td>
                <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalRevenue)}</td>
                <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">{formatCurrency(totalCostNoFreight)}</td>
                <td className="px-3 py-2 border-t border-stone-200 text-right font-semibold">
                  <span className={totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(totalProfit)}</span>
                </td>
                <td colSpan={5} className="px-3 py-2 border-t border-stone-200"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
