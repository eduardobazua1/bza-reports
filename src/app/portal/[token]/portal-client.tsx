"use client";

import { useState, useEffect, useMemo } from "react";
import { BzaLogo } from "@/components/bza-logo";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";

type DocInfo = { id: number; type: string };
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

export function PortalClient({ token, userName }: { token: string; userName?: string }) {
  const [data, setData] = useState<{ name: string; shipments: Shipment[] } | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"active" | "delivered" | "all">("active");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [poSearch, setPoSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.shipments;
    if (filter === "active") list = list.filter(s => s.status !== "entregado");
    if (filter === "delivered") list = list.filter(s => s.status === "entregado");
    if (dateFrom) list = list.filter(s => s.date && s.date >= dateFrom);
    if (dateTo) list = list.filter(s => s.date && s.date <= dateTo);
    if (poSearch) list = list.filter(s => (s.po || "").toLowerCase().includes(poSearch.toLowerCase()));
    if (productSearch) list = list.filter(s => (s.product || "").toLowerCase().includes(productSearch.toLowerCase()));
    return list;
  }, [data, filter, dateFrom, dateTo, poSearch, productSearch]);

  const activeFilters = [dateFrom, dateTo, poSearch, productSearch].filter(Boolean).length;
  const totalTons = filtered.reduce((a, s) => a + s.tons, 0);
  const activeCount = data ? data.shipments.filter(s => s.status !== "entregado").length : 0;
  const deliveredCount = data ? data.shipments.filter(s => s.status === "entregado").length : 0;

  function downloadUrl(format: string) {
    const params = new URLSearchParams({ format, filter });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (poSearch) params.set("po", poSearch);
    if (productSearch) params.set("product", productSearch);
    return `/api/portal/${token}/export?${params}`;
  }

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

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white sticky top-0 z-10 border-b border-stone-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BzaLogo size="md" />
          <div className="text-right flex items-center gap-3">
            <div>
              {userName && (
                <p className="text-sm font-medium text-stone-800">
                  Welcome, {userName.split(" ")[0]}
                </p>
              )}
              <p className="text-[11px] text-stone-400">{data.name}</p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/portal/logout", { method: "POST" });
                window.location.reload();
              }}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-lg px-2 py-1"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* 3-way tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-lg mx-auto flex">
          {(["active", "delivered", "all"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${filter === t ? "border-blue-500 text-blue-600" : "border-transparent text-stone-400"}`}>
              {t === "active" ? `Active (${activeCount})` : t === "delivered" ? `Delivered (${deliveredCount})` : `All (${data.shipments.length})`}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Filters + Downloads */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowFilters(!showFilters)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm">
            <span className="font-medium text-stone-700">
              Filters {activeFilters > 0 && <span className="ml-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
            </span>
            <svg className={`w-4 h-4 text-stone-400 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFilters && (
            <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-400 uppercase">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 uppercase">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <input type="text" placeholder="Search PO..." value={poSearch} onChange={e => setPoSearch(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
              <input type="text" placeholder="Search product..." value={productSearch} onChange={e => setProductSearch(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
              {activeFilters > 0 && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setPoSearch(""); setProductSearch(""); }}
                  className="text-xs text-blue-600 font-medium">Clear filters</button>
              )}
            </div>
          )}
        </div>

        {/* Download buttons */}
        <div className="flex gap-2">
          <a href={downloadUrl("pdf")} className="flex-1 flex items-center justify-center gap-2 bg-white border border-blue-500 text-blue-600 rounded-xl py-2.5 text-sm font-medium shadow-sm hover:bg-blue-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
            PDF
          </a>
          <a href={downloadUrl("xlsx")} className="flex-1 flex items-center justify-center gap-2 bg-white border border-emerald-500 text-emerald-600 rounded-xl py-2.5 text-sm font-medium shadow-sm hover:bg-emerald-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
            Excel
          </a>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Showing</p>
            <p className="text-2xl font-bold text-stone-900">{filtered.length}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Volume</p>
            <p className="text-2xl font-bold text-stone-900">{formatNumber(totalTons, 0)} <span className="text-sm font-normal text-stone-400">TN</span></p>
          </div>
        </div>

        {/* Shipment cards */}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">No shipments found</div>
        )}

        {filtered.filter(s => s.status !== "entregado").map((s) => (
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
            {(s.docs.length > 0 || s.inv) && (
              <div className="px-4 py-2 border-t border-stone-100">
                <div className="flex flex-wrap gap-1.5">
                  {/* Generated invoice PDF */}
                  <a href={`/api/invoice-pdf?invoice=${s.inv}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-2 py-1 rounded-md font-medium bg-orange-50 text-orange-600">
                    Invoice PDF
                  </a>
                  {s.docs.map((d) => (
                    <a key={d.id} href={`/api/documents/download/${d.id}`} target="_blank" rel="noopener noreferrer"
                      className={`text-[10px] px-2 py-1 rounded-md font-medium ${typeColors[d.type] || typeColors.other}`}>
                      {typeLabels[d.type] || d.type}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Delivered cards (compact) */}
        {filtered.filter(s => s.status === "entregado").map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-800 truncate">{s.product}</p>
              <p className="text-[11px] text-stone-400">{s.po || ""} · {formatNumber(s.tons, 3)} TN · {formatDate(s.date)}</p>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))}
      </main>

      <footer className="text-center text-[10px] text-stone-300 py-6">BZA International Services, LLC · McAllen, TX</footer>
    </div>
  );
}
