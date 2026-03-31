"use client";

import { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

type ClientPO = {
  id: number;
  purchaseOrderId: number;
  clientPoNumber: string;
  destination: string | null;
  plannedTons: number | null;
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
};

export function ClientPOsSection({
  purchaseOrderId,
  clientPos,
  poNumber,
  sellPrice,
  product,
}: {
  purchaseOrderId: number;
  clientPos: ClientPO[];
  poNumber?: string;
  sellPrice?: number;
  product?: string;
}) {
  const [list, setList] = useState<ClientPO[]>(clientPos);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    invoiceNumber: "",
    vehicleId: "",
    blNumber: "",
    shipmentDate: new Date().toISOString().split("T")[0],
    invoiceDate: new Date().toISOString().split("T")[0],
    quantityTons: "",
  });
  const [addForm, setAddForm] = useState({
    clientPoNumber: "",
    destination: "",
    plannedTons: "",
    sellPriceOverride: "",
  });

  const totalPlanned = list.reduce((s, p) => s + (p.plannedTons || 0), 0);
  const totalAmount = sellPrice
    ? list.reduce((s, p) => s + (p.plannedTons || 0) * sellPrice, 0)
    : 0;

  // Suggest next invoice number based on PO
  function suggestInvoiceNumber(invoiceCount: number) {
    if (!poNumber) return "";
    // e.g. X0043 → IX0043-1
    const base = poNumber.replace("X", "IX");
    return `${base}-${invoiceCount + 1}`;
  }

  function openConvert(cpo: ClientPO, invoiceCount: number) {
    setConvertingId(cpo.id);
    setConvertForm({
      invoiceNumber: suggestInvoiceNumber(invoiceCount),
      vehicleId: "",
      blNumber: "",
      shipmentDate: new Date().toISOString().split("T")[0],
      invoiceDate: new Date().toISOString().split("T")[0],
      quantityTons: cpo.plannedTons?.toString() || "",
    });
  }

  async function handleConvert(cpo: ClientPO) {
    if (!convertForm.quantityTons || !convertForm.invoiceNumber) return;
    setConvertLoading(true);
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
        item: product || null,
        shipmentStatus: "programado",
      }),
    });

    if (res.ok) {
      // Update client PO status to partial/complete
      await fetch(`/api/client-pos/${cpo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "partial" }),
      });
      setList((prev) =>
        prev.map((p) => (p.id === cpo.id ? { ...p, status: "partial" } : p))
      );
      setConvertingId(null);
      // Reload page to show new invoice in table
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
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setAddForm({ clientPoNumber: "", destination: "", plannedTons: "", sellPriceOverride: "" });
      setAdding(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este Client PO?")) return;
    await fetch(`/api/client-pos/${id}`, { method: "DELETE" });
    setList((prev) => prev.filter((p) => p.id !== id));
  }

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    partial: "bg-blue-100 text-blue-700",
    complete: "bg-emerald-100 text-emerald-700",
  };
  const statusLabels: Record<string, string> = {
    pending: "Pendiente",
    partial: "Parcial",
    complete: "Completo",
  };

  // Count existing invoices per client PO to suggest next invoice number
  let invoiceCounter = 0;

  return (
    <div className="bg-white rounded-md shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">
            Órdenes del Cliente ({list.length})
          </h3>
          {totalPlanned > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">
              {formatNumber(totalPlanned, 1)} TN planificadas
              {totalAmount > 0 && ` · ${formatCurrency(totalAmount)} estimado`}
            </p>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:bg-[#0a2e2d] transition"
        >
          + Agregar Orden
        </button>
      </div>

      {list.length === 0 && !adding && (
        <p className="p-6 text-center text-stone-400 text-sm">
          Sin órdenes del cliente. Agrega las órdenes antes de generar facturas.
        </p>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">PO Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Destino</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-500">Tons</th>
                {sellPrice && (
                  <th className="text-right px-4 py-2.5 font-medium text-stone-500">Monto Est.</th>
                )}
                <th className="text-left px-4 py-2.5 font-medium text-stone-500">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium text-stone-500">Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((cpo) => {
                const amount = sellPrice && cpo.plannedTons ? cpo.plannedTons * sellPrice : null;
                const isConverting = convertingId === cpo.id;
                invoiceCounter++;

                return (
                  <>
                    <tr key={cpo.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 border-t border-stone-100 font-mono text-xs font-semibold text-[#0d3d3b]">
                        {cpo.clientPoNumber}
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100">{cpo.destination || "—"}</td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">
                        {cpo.plannedTons ? formatNumber(cpo.plannedTons, 1) : "—"}
                      </td>
                      {sellPrice && (
                        <td className="px-4 py-3 border-t border-stone-100 text-right font-medium">
                          {amount ? formatCurrency(amount) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 border-t border-stone-100">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[cpo.status]}`}>
                          {statusLabels[cpo.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-t border-stone-100 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {cpo.status !== "complete" && (
                            <button
                              onClick={() => openConvert(cpo, invoiceCounter - 1)}
                              className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded hover:bg-emerald-700 transition font-medium"
                            >
                              Convertir a Factura →
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(cpo.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Convert to Invoice inline form */}
                    {isConverting && (
                      <tr key={`convert-${cpo.id}`}>
                        <td colSpan={sellPrice ? 6 : 5} className="p-0">
                          <div className="bg-emerald-50 border-t border-emerald-200 p-4">
                            <p className="text-xs font-semibold text-emerald-800 uppercase mb-3">
                              Nueva Factura — PO Cliente {cpo.clientPoNumber} · {cpo.destination}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Factura # *</label>
                                <input
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                                  placeholder="IX0043-1"
                                  value={convertForm.invoiceNumber}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Tons ADMT *</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  placeholder="91.440"
                                  value={convertForm.quantityTons}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, quantityTons: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Vagón #</label>
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
                                <label className="block text-xs text-stone-500 mb-1">Fecha embarque</label>
                                <input
                                  type="date"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  value={convertForm.shipmentDate}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, shipmentDate: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-stone-500 mb-1">Fecha factura</label>
                                <input
                                  type="date"
                                  className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                                  value={convertForm.invoiceDate}
                                  onChange={(e) => setConvertForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                                />
                              </div>
                            </div>

                            {/* Amount preview */}
                            {sellPrice && convertForm.quantityTons && (
                              <div className="mt-3 text-sm text-emerald-800 font-medium">
                                Total factura: {formatCurrency(parseFloat(convertForm.quantityTons) * sellPrice)}
                                {" "}({convertForm.quantityTons} TN × ${sellPrice}/TN)
                              </div>
                            )}

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleConvert(cpo)}
                                disabled={convertLoading || !convertForm.invoiceNumber || !convertForm.quantityTons}
                                className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
                              >
                                {convertLoading ? "Creando..." : "Crear Factura"}
                              </button>
                              <button
                                onClick={() => setConvertingId(null)}
                                className="text-sm text-stone-500 hover:text-stone-700 px-3 py-1.5"
                              >
                                Cancelar
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

      {/* Add new Client PO form */}
      {adding && (
        <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase">Nueva Orden del Cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">PO # del cliente *</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm font-mono"
                placeholder="X190165"
                value={addForm.clientPoNumber}
                onChange={(e) => setAddForm((f) => ({ ...f, clientPoNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Destino</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="Morelia, Ecatepec, Bajio..."
                value={addForm.destination}
                onChange={(e) => setAddForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Tons planificadas</label>
              <input
                type="number"
                step="0.1"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="270"
                value={addForm.plannedTons}
                onChange={(e) => setAddForm((f) => ({ ...f, plannedTons: e.target.value }))}
              />
            </div>
          </div>
          {sellPrice && addForm.plannedTons && (
            <p className="text-xs text-stone-500">
              Monto estimado: {formatCurrency(parseFloat(addForm.plannedTons) * sellPrice)}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !addForm.clientPoNumber}
              className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:bg-[#0a2e2d] disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
