"use client";

import { useState, useEffect } from "react";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";

type DocInfo = { id: number; type: string; fileUrl: string };
type Shipment = {
  id: number; inv: string; po: string | null; product: string | null;
  tons: number; date: string | null; eta: string | null; status: string;
  loc: string | null; vehicle: string | null; bl: string | null;
  transport: string | null; docs: DocInfo[];
};

const statusSteps = ["programado", "en_transito", "en_aduana", "entregado"];
const typeLabels: Record<string, string> = { invoice: "Invoice", bl: "Bill of Lading", pl: "Packing List", other: "Other" };
const typeColors: Record<string, string> = { invoice: "bg-blue-50 text-blue-600", bl: "bg-emerald-50 text-emerald-600", pl: "bg-amber-50 text-amber-600", other: "bg-stone-100 text-stone-500" };

function StatusStepper({ status }: { status: string }) {
  const idx = statusSteps.indexOf(status);
  const labels = ["Scheduled", "In Transit", "Customs", "Delivered"];
  return (
    <div className="flex items-center justify-between w-full">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i <= idx ? i === idx ? "bg-blue-500 text-white" : "bg-emerald-500 text-white" : "bg-stone-200 text-stone-400"
            }`}>{i < idx ? "✓" : i + 1}</div>
            <span className={`text-[9px] mt-0.5 ${i <= idx ? "text-stone-700 font-medium" : "text-stone-400"}`}>{label}</span>
          </div>
          {i < 3 && <div className={`flex-1 h-0.5 mx-0.5 mt-[-14px] ${i < idx ? "bg-emerald-400" : "bg-stone-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = status === "en_transito" ? "bg-blue-50 text-blue-600" :
    status === "en_aduana" ? "bg-amber-50 text-amber-600" :
    status === "entregado" ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500";
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c}`}>{shipmentStatusLabels[status] || status}</span>;
}

export function PortalClient({ token }: { token: string }) {
  const [data, setData] = useState<{ name: string; shipments: Shipment[] } | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"active" | "delivered">("active");

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  if (error) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <p className="text-stone-500">Portal not found</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-400 text-sm">Loading shipments...</p>
      </div>
    </div>
  );

  const active = data.shipments.filter(s => s.status !== "entregado");
  const delivered = data.shipments.filter(s => s.status === "entregado");
  const totalTons = active.reduce((a, s) => a + s.tons, 0);

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/bza-logo-new.png" alt="BZA" className="h-7" />
          <div className="text-right">
            <p className="text-sm font-medium text-stone-800">{data.name}</p>
            <p className="text-[10px] text-stone-400">Shipment Portal</p>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-stone-200">
        <div className="max-w-lg mx-auto flex">
          <button onClick={() => setTab("active")}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${tab === "active" ? "border-blue-500 text-blue-600" : "border-transparent text-stone-400"}`}>
            Active ({active.length})
          </button>
          <button onClick={() => setTab("delivered")}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${tab === "delivered" ? "border-blue-500 text-blue-600" : "border-transparent text-stone-400"}`}>
            Delivered ({delivered.length})
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {tab === "active" && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-stone-900">{active.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-stone-400 uppercase tracking-wide">Volume</p>
                <p className="text-2xl font-bold text-stone-900">{formatNumber(totalTons, 0)} <span className="text-sm font-normal text-stone-400">TN</span></p>
              </div>
            </div>

            {active.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">No active shipments</div>
            )}

            {active.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 truncate text-sm">{s.product}</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">{s.po || ""} · {s.inv}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <StatusStepper status={s.status} />
                </div>
                <div className="px-4 py-3 bg-stone-50 grid grid-cols-2 gap-2 text-[11px]">
                  <div><p className="text-stone-400">Quantity</p><p className="font-semibold text-stone-800">{formatNumber(s.tons, 3)} TN</p></div>
                  <div><p className="text-stone-400">Ship Date</p><p className="font-semibold text-stone-800">{formatDate(s.date)}</p></div>
                  {s.vehicle && <div><p className="text-stone-400">Vehicle</p><p className="font-semibold text-stone-800 font-mono text-[10px]">{s.vehicle}</p></div>}
                  {s.bl && <div><p className="text-stone-400">BL#</p><p className="font-semibold text-stone-800">{s.bl}</p></div>}
                  {s.loc && <div><p className="text-stone-400">Location</p><p className="font-semibold text-stone-800">{s.loc}</p></div>}
                  {s.eta && <div><p className="text-stone-400">ETA</p><p className="font-semibold text-stone-800">{formatDate(s.eta)}</p></div>}
                  {s.transport && <div><p className="text-stone-400">Transport</p><p className="font-semibold text-stone-800">{transportTypeLabels[s.transport] || s.transport}</p></div>}
                </div>
                {s.docs.length > 0 && (
                  <div className="px-4 py-2 border-t border-stone-100">
                    <div className="flex flex-wrap gap-1.5">
                      {s.docs.map((d) => (
                        <a key={d.id} href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                          className={`text-[10px] px-2 py-1 rounded-md font-medium ${typeColors[d.type] || typeColors.other}`}>
                          {typeLabels[d.type] || d.type}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "delivered" && (
          <div className="space-y-2">
            {delivered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{s.product}</p>
                  <p className="text-[11px] text-stone-400">{s.po || ""} · {formatNumber(s.tons, 3)} TN · {formatDate(s.date)}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {delivered.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">No delivered shipments</div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-[10px] text-stone-300 py-6">BZA International Services, LLC · McAllen, TX</footer>
    </div>
  );
}
