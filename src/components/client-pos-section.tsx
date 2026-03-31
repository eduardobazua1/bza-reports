"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/utils";

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

export function ClientPOsSection({
  purchaseOrderId,
  clientPos,
}: {
  purchaseOrderId: number;
  clientPos: ClientPO[];
}) {
  const [list, setList] = useState<ClientPO[]>(clientPos);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientPoNumber: "",
    destination: "",
    plannedTons: "",
  });

  const totalPlanned = list.reduce((s, p) => s + (p.plannedTons || 0), 0);

  async function handleAdd() {
    if (!form.clientPoNumber) return;
    setLoading(true);
    const res = await fetch("/api/client-pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId,
        clientPoNumber: form.clientPoNumber,
        destination: form.destination || null,
        plannedTons: form.plannedTons ? parseFloat(form.plannedTons) : null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setList((prev) => [...prev, data]);
      setForm({ clientPoNumber: "", destination: "", plannedTons: "" });
      setAdding(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this client PO?")) return;
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

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Client Purchase Orders ({list.length})
          </h3>
          {totalPlanned > 0 && (
            <p className="text-xs text-stone-400 mt-0.5">
              {formatNumber(totalPlanned, 1)} TN planned
            </p>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:bg-[#0a2e2d] transition"
        >
          + Add Client PO
        </button>
      </div>

      {list.length === 0 && !adding && (
        <p className="p-6 text-center text-stone-400 text-sm">
          No client POs yet. Add the orders from the client.
        </p>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Client PO #</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Destination</th>
                <th className="text-right px-3 py-2 font-medium text-stone-500">Planned Tons</th>
                <th className="text-left px-3 py-2 font-medium text-stone-500">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((cpo) => (
                <tr key={cpo.id} className="hover:bg-stone-50">
                  <td className="px-3 py-2 border-t border-stone-100 font-mono text-xs font-semibold">
                    {cpo.clientPoNumber}
                  </td>
                  <td className="px-3 py-2 border-t border-stone-100">{cpo.destination || "-"}</td>
                  <td className="px-3 py-2 border-t border-stone-100 text-right">
                    {cpo.plannedTons ? formatNumber(cpo.plannedTons, 1) : "-"}
                  </td>
                  <td className="px-3 py-2 border-t border-stone-100">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[cpo.status]}`}>
                      {statusLabels[cpo.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-t border-stone-100 text-right">
                    <button
                      onClick={() => handleDelete(cpo.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="p-4 border-t border-stone-100 bg-stone-50 space-y-3">
          <p className="text-xs font-semibold text-stone-500 uppercase">New Client PO</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Client PO Number *</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="e.g. X189014"
                value={form.clientPoNumber}
                onChange={(e) => setForm((f) => ({ ...f, clientPoNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Destination</label>
              <input
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="e.g. Morelia"
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Planned Tons</label>
              <input
                type="number"
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                placeholder="e.g. 270"
                value={form.plannedTons}
                onChange={(e) => setForm((f) => ({ ...f, plannedTons: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={loading || !form.clientPoNumber}
              className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:bg-[#0a2e2d] disabled:opacity-50"
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
