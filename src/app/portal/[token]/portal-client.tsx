"use client";

import { useState, useEffect } from "react";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";
import { DocumentList } from "@/components/document-upload";

type Shipment = {
  id: number;
  invoiceNumber: string;
  poNumber: string | null;
  clientPoNumber: string | null;
  product: string | null;
  quantityTons: number;
  shipmentDate: string | null;
  estimatedArrival: string | null;
  shipmentStatus: string;
  currentLocation: string | null;
  lastLocationUpdate: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  transportType: string | null;
  terms: string | null;
  updates: { id: number; date: string; status: string }[];
};

type PO = {
  poNumber: string;
  clientPo: string;
  product: string;
  totalTons: number;
  invoiceCount: number;
  status: string;
  shipments: Shipment[];
};

const statusSteps = ["programado", "en_transito", "en_aduana", "entregado"];

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = statusSteps.indexOf(currentStatus);
  const labels = ["Scheduled", "In Transit", "Customs", "Delivered"];

  return (
    <div className="flex items-center justify-between w-full">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i <= currentIndex
                ? i === currentIndex ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
                : "bg-stone-200 text-stone-400"
            }`}>
              {i < currentIndex ? "✓" : i + 1}
            </div>
            <span className={`text-[9px] mt-0.5 ${i <= currentIndex ? "text-stone-700 font-medium" : "text-stone-400"}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mx-0.5 mt-[-14px] ${i < currentIndex ? "bg-emerald-400" : "bg-stone-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function PortalClient({ clientName, shipments, purchaseOrders }: {
  clientName: string;
  shipments: Shipment[];
  purchaseOrders: PO[];
}) {
  const [tab, setTab] = useState<"shipments" | "orders">("shipments");
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const active = shipments.filter(s => s.shipmentStatus !== "entregado");
  const delivered = shipments.filter(s => s.shipmentStatus === "entregado");
  const totalActiveTons = active.reduce((s, d) => s + d.quantityTons, 0);

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/bza-logo-new.png" alt="BZA" className="h-7" />
          <div className="text-right">
            <p className="text-sm font-medium text-stone-800">{clientName}</p>
            <p className="text-[10px] text-stone-400">Shipment Portal</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setTab("shipments")}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              tab === "shipments" ? "border-blue-500 text-blue-600" : "border-transparent text-stone-400"
            }`}
          >
            Shipments ({active.length})
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
              tab === "orders" ? "border-blue-500 text-blue-600" : "border-transparent text-stone-400"
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* ====== SHIPMENTS TAB ====== */}
        {tab === "shipments" && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-stone-900">{active.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-stone-400 uppercase tracking-wide">Volume</p>
                <p className="text-2xl font-bold text-stone-900">{formatNumber(totalActiveTons, 0)} <span className="text-sm font-normal text-stone-400">TN</span></p>
              </div>
            </div>

            {/* Active shipments */}
            {active.length > 0 && (
              <div className="space-y-3">
                {active.map((s) => (
                  <ShipmentCard key={s.id} shipment={s} />
                ))}
              </div>
            )}

            {active.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center text-stone-400">
                No active shipments
              </div>
            )}

            {/* Delivered */}
            {delivered.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide pt-2">
                  Delivered ({delivered.length})
                </h2>
                {delivered.slice(0, 10).map((s) => (
                  <div key={s.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{s.product}</p>
                      <p className="text-[11px] text-stone-400">
                        {s.clientPoNumber || ""} · {formatNumber(s.quantityTons, 1)} TN · {formatDate(s.shipmentDate)}
                      </p>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full ml-2">Delivered</span>
                  </div>
                ))}
                {delivered.length > 10 && (
                  <p className="text-[10px] text-center text-stone-400">and {delivered.length - 10} more</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ====== PURCHASE ORDERS TAB ====== */}
        {tab === "orders" && (
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <div key={po.poNumber} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedPO(expandedPO === po.poNumber ? null : po.poNumber)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900">{po.clientPo !== "-" ? po.clientPo : po.poNumber}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        po.status === "active" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {po.status === "active" ? "Active" : "Delivered"}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">{po.product} · {po.invoiceCount} shipments · {formatNumber(po.totalTons, 0)} TN</p>
                  </div>
                  <svg className={`w-4 h-4 text-stone-400 transition-transform ${expandedPO === po.poNumber ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded: show invoices */}
                {expandedPO === po.poNumber && (
                  <div className="border-t border-stone-100 px-4 pb-4">
                    <div className="divide-y divide-stone-100">
                      {po.shipments.map((s) => (
                        <div key={s.id} className="py-3 first:pt-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-stone-800">{s.invoiceNumber}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              s.shipmentStatus === "entregado" ? "bg-emerald-50 text-emerald-600" :
                              s.shipmentStatus === "en_transito" ? "bg-blue-50 text-blue-600" :
                              s.shipmentStatus === "en_aduana" ? "bg-amber-50 text-amber-600" :
                              "bg-stone-100 text-stone-500"
                            }`}>
                              {shipmentStatusLabels[s.shipmentStatus] || s.shipmentStatus}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <div><span className="text-stone-400">Tons:</span> <span className="font-medium">{formatNumber(s.quantityTons, 1)}</span></div>
                            <div><span className="text-stone-400">Date:</span> <span className="font-medium">{formatDate(s.shipmentDate)}</span></div>
                            {s.vehicleId && <div><span className="text-stone-400">Vehicle:</span> <span className="font-medium font-mono text-[10px]">{s.vehicleId}</span></div>}
                            {s.blNumber && <div><span className="text-stone-400">BL#:</span> <span className="font-medium">{s.blNumber}</span></div>}
                            {s.currentLocation && <div><span className="text-stone-400">Location:</span> <span className="font-medium">{s.currentLocation}</span></div>}
                            {s.estimatedArrival && <div><span className="text-stone-400">ETA:</span> <span className="font-medium">{formatDate(s.estimatedArrival)}</span></div>}
                          </div>
                          <div className="mt-1.5">
                            <DocumentList invoiceId={s.id} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-[10px] text-stone-300 py-6">
        BZA International Services, LLC · McAllen, TX
      </footer>
    </div>
  );
}

function ShipmentCard({ shipment: s }: { shipment: Shipment }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 truncate text-sm">{s.product}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {s.clientPoNumber || ""} · {s.invoiceNumber}
            </p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ml-2 shrink-0 font-medium ${
            s.shipmentStatus === "en_transito" ? "bg-blue-50 text-blue-600" :
            s.shipmentStatus === "en_aduana" ? "bg-amber-50 text-amber-600" :
            s.shipmentStatus === "entregado" ? "bg-emerald-50 text-emerald-600" :
            "bg-stone-100 text-stone-500"
          }`}>
            {shipmentStatusLabels[s.shipmentStatus] || s.shipmentStatus}
          </span>
        </div>
        <StatusStepper currentStatus={s.shipmentStatus} />
      </div>

      <div className="px-4 py-3 bg-stone-50 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-stone-400">Quantity</p>
          <p className="font-semibold text-stone-800">{formatNumber(s.quantityTons, 1)} TN</p>
        </div>
        <div>
          <p className="text-stone-400">Ship Date</p>
          <p className="font-semibold text-stone-800">{formatDate(s.shipmentDate)}</p>
        </div>
        {s.vehicleId && (
          <div>
            <p className="text-stone-400">Vehicle / Railcar</p>
            <p className="font-semibold text-stone-800 font-mono text-[10px]">{s.vehicleId}</p>
          </div>
        )}
        {s.blNumber && (
          <div>
            <p className="text-stone-400">BL Number</p>
            <p className="font-semibold text-stone-800">{s.blNumber}</p>
          </div>
        )}
        {s.currentLocation && (
          <div>
            <p className="text-stone-400">Location</p>
            <p className="font-semibold text-stone-800">{s.currentLocation}</p>
          </div>
        )}
        {s.estimatedArrival && (
          <div>
            <p className="text-stone-400">ETA</p>
            <p className="font-semibold text-stone-800">{formatDate(s.estimatedArrival)}</p>
          </div>
        )}
        {s.transportType && (
          <div>
            <p className="text-stone-400">Transport</p>
            <p className="font-semibold text-stone-800">{transportTypeLabels[s.transportType] || s.transportType}</p>
          </div>
        )}
        {s.terms && (
          <div>
            <p className="text-stone-400">Terms</p>
            <p className="font-semibold text-stone-800">{s.terms}</p>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="px-4 py-2 border-t border-stone-100">
        <p className="text-[9px] font-medium text-stone-400 uppercase tracking-wide mb-1">Documents</p>
        <DocumentList invoiceId={s.id} />
      </div>

      {s.updates.length > 0 && (
        <div className="px-4 py-2 border-t border-stone-100">
          <p className="text-[9px] font-medium text-stone-400 uppercase tracking-wide mb-1">History</p>
          {s.updates.slice(0, 3).map((u) => (
            <div key={u.id} className="flex items-center gap-1.5 text-[10px] py-0.5">
              <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              <span className="text-stone-400">{formatDate(u.date)}</span>
              <span className="text-stone-600 font-medium">{shipmentStatusLabels[u.status] || u.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
