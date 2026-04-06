"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { DocumentUpload } from "@/components/document-upload";
import { duplicateInvoice } from "@/server/actions";

type Invoice = {
  id: number;
  invoiceNumber: string;
  salesDocument: string | null;
  destination: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  shipmentDate: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paymentTermsDays: number | null;
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

function calcDueDate(inv: Invoice, clientTermsDays: number): string | null {
  const base = inv.invoiceDate || inv.shipmentDate;
  if (!base) return null;
  const terms = (inv.paymentTermsDays != null && inv.paymentTermsDays > 0)
    ? inv.paymentTermsDays
    : clientTermsDays;
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + terms);
  return d.toISOString().split("T")[0];
}

export function InvoicesSection({
  invoices: initialInvoices,
  poSellPrice,
  poBuyPrice,
  products,
  clientTermsDays = 60,
  clientEmail,
}: {
  invoices: Invoice[];
  poSellPrice: number;
  poBuyPrice: number;
  products: Product[];
  clientTermsDays?: number;
  clientEmail?: string | null;
}) {
  const [list, setList] = useState<Invoice[]>(initialInvoices);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [sendDocs, setSendDocs] = useState<{ id: number; fileName: string; type: string }[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
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

  async function openSend(inv: Invoice) {
    setSendingId(inv.id);
    setSendTo(clientEmail || "");
    setSendCc("");
    setSentId(null);
    setEditingId(null);
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?invoiceId=${inv.id}`);
      if (res.ok) {
        const all: { id: number; fileName: string; type: string }[] = await res.json();
        const blPl = all.filter(d => d.type === "bl" || d.type === "pl");
        setSendDocs(blPl);
        setSelectedDocIds(blPl.map(d => d.id));
      }
    } finally {
      setDocsLoading(false);
    }
  }

  function toggleSendDoc(id: number) {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSend(inv: Invoice) {
    if (!sendTo) return;
    setSendLoading(true);
    const res = await fetch("/api/invoice-pdf/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber: inv.invoiceNumber, to: sendTo, cc: sendCc || undefined, documentIds: selectedDocIds }),
    });
    if (res.ok) {
      const data = await res.json();
      setSentId(inv.id);
      setSendingId(null);
      alert(`Sent! ${data.attachmentCount} attachment(s) delivered.`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error sending email");
    }
    setSendLoading(false);
  }

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
        <table className="w-full text-xs">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Client PO</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Invoice #</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Product</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Destination</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Vehicle</th>
              <th className="text-right px-3 py-1.5 font-medium text-stone-500">Tons</th>
              <th className="text-right px-3 py-1.5 font-medium text-stone-500">Revenue</th>
              <th className="text-right px-3 py-1.5 font-medium text-stone-500">Cost</th>
              <th className="text-right px-3 py-1.5 font-medium text-stone-500">Profit</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Ship Date</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Due Date</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Status</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Payment</th>
              <th className="text-left px-3 py-1.5 font-medium text-stone-500">Attachments</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={15} className="p-6 text-center text-stone-400">No invoices for this PO.</td></tr>
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
                    <td className="px-3 py-1.5 border-t border-stone-100 font-mono text-xs font-medium">{inv.salesDocument || "—"}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 whitespace-nowrap">
                      {inv.invoiceNumber.startsWith("PEND-") ? (
                        <span className="text-amber-500 italic">Pending</span>
                      ) : (
                        <span className="font-medium">{inv.invoiceNumber}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-stone-600 text-xs">{inv.item || "—"}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-stone-500">{inv.destination || "—"}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-stone-500 font-mono text-xs">{inv.vehicleId || "—"}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-right">{formatNumber(inv.quantityTons, 3)}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-right">{formatCurrency(revenue)}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-right">{formatCurrency(inv.quantityTons * buy)}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-right font-medium">
                      <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>{formatCurrency(profit)}</span>
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100">{formatDate(inv.shipmentDate)}</td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-xs text-stone-500">
                      {formatDate(calcDueDate(inv, clientTermsDays)) || "—"}
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${shipmentStatusColors[inv.shipmentStatus] || ""}`}>
                        {shipmentStatusLabels[inv.shipmentStatus] || inv.shipmentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColors[inv.customerPaymentStatus] || ""}`}>
                        {inv.customerPaymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100">
                      <DocumentUpload invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
                    </td>
                    <td className="px-3 py-1.5 border-t border-stone-100 text-right">
                      <div className="flex items-center justify-end gap-0">
                        <button
                          onClick={() => isEditing ? cancelEdit() : openEdit(inv)}
                          className="text-xs text-primary font-medium px-2 py-1 hover:bg-blue-50 rounded-l border border-stone-200"
                        >
                          {isEditing ? "Cancel" : "View/Edit"}
                        </button>
                        <div ref={openDropdownId === inv.id ? dropdownRef : undefined}>
                          <button
                            onClick={(e) => {
                              if (openDropdownId === inv.id) { setOpenDropdownId(null); return; }
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setDropdownPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                              setOpenDropdownId(inv.id);
                            }}
                            className="text-xs text-primary font-medium px-2 py-1 hover:bg-blue-50 rounded-r border border-l-0 border-stone-200"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Send form */}
                  {sendingId === inv.id && (
                    <tr key={`send-${inv.id}`}>
                      <td colSpan={15} className="p-0">
                        <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 space-y-2">
                          <p className="text-xs font-semibold text-blue-800">Send Invoice {inv.invoiceNumber}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-700 font-medium whitespace-nowrap">To:</span>
                              <input
                                type="email"
                                className="border border-blue-200 rounded px-2 py-1 text-sm w-56"
                                placeholder="client@example.com"
                                value={sendTo}
                                onChange={(e) => setSendTo(e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-700 font-medium whitespace-nowrap">CC:</span>
                              <input
                                type="email"
                                className="border border-blue-200 rounded px-2 py-1 text-sm w-56"
                                placeholder="optional"
                                value={sendCc}
                                onChange={(e) => setSendCc(e.target.value)}
                              />
                            </div>
                            <button
                              onClick={() => handleSend(inv)}
                              disabled={sendLoading || !sendTo}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                            >
                              {sendLoading ? "Sending..." : "Send"}
                            </button>
                            <button onClick={() => setSendingId(null)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                          </div>
                          {docsLoading ? (
                            <p className="text-xs text-stone-400">Loading documents...</p>
                          ) : sendDocs.length > 0 ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-stone-500 font-medium">Attach:</span>
                              {sendDocs.map(d => (
                                <label key={d.id} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-3 h-3"
                                    checked={selectedDocIds.includes(d.id)}
                                    onChange={() => toggleSendDoc(d.id)}
                                  />
                                  <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                  <span className="text-xs text-stone-600">{d.fileName}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400">Invoice PDF only (no BOL/PL uploaded)</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Edit form */}
                  {isEditing && (
                    <tr key={`edit-${inv.id}`}>
                      <td colSpan={15} className="p-0">
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
                <td colSpan={6} className="px-3 py-2 border-t border-stone-200"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dropdown — fixed position to escape overflow containers */}
      {openDropdownId !== null && dropdownPos && (() => {
        const inv = list.find(i => i.id === openDropdownId);
        if (!inv) return null;
        return (
          <div ref={dropdownRef} style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }} className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[150px] py-1 text-left">
            <button onClick={() => { setOpenDropdownId(null); openEdit(inv); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">View/Edit</button>
            <a href={`/api/invoice-pdf?invoice=${inv.invoiceNumber}`} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpenDropdownId(null)}>Print</a>
            {!inv.invoiceNumber.startsWith("PEND-") && (
              sentId === inv.id ? (
                <span className="block px-4 py-2 text-sm text-emerald-600 font-medium">Sent ✓</span>
              ) : (
                <button onClick={() => { setOpenDropdownId(null); openSend(inv); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Send</button>
              )
            )}
            <button onClick={() => { setOpenDropdownId(null); startTransition(async () => { await duplicateInvoice(inv.id); router.refresh(); }); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Duplicate</button>
            <div className="border-t border-stone-100 my-1" />
            <button onClick={() => { setOpenDropdownId(null); if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return; fetch(`/api/invoices/${inv.id}`, { method: "DELETE" }).then(() => router.refresh()); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
          </div>
        );
      })()}
    </div>
  );
}
