"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { updateInvoice } from "@/server/actions";
import { useRouter } from "next/navigation";
import { shipmentStatusLabels, shipmentStatusColors } from "@/lib/utils";

const statuses = [
  { value: "programado", label: "Scheduled" },
  { value: "en_transito", label: "In Transit" },
  { value: "en_aduana", label: "Customs" },
  { value: "entregado", label: "Delivered" },
] as const;

export function ShipmentStatusBadge({
  invoiceId,
  currentStatus,
}: {
  invoiceId: number;
  currentStatus: "programado" | "en_transito" | "en_aduana" | "entregado";
}) {
  const [open, setOpen] = useState(false);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      const insideTrigger = ref.current?.contains(t);
      const insideDropdown = dropdownRef.current?.contains(t);
      if (!insideTrigger && !insideDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => {
          if (!open) {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            const dropdownW = 140;
            const left = (rect.right + dropdownW + 4) > window.innerWidth
              ? rect.left - dropdownW - 4
              : rect.right + 4;
            const estimatedH = 180;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow < estimatedH ? rect.top - estimatedH - 4 : rect.bottom + 4;
            setPosStyle({ position: "fixed", top, left: Math.max(4, left), zIndex: 9999 });
          }
          setOpen((v) => !v);
        }}
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 ${shipmentStatusColors[currentStatus]}`}
      >
        {shipmentStatusLabels[currentStatus]} ▾
      </button>
      {open && createPortal(
        <div style={posStyle} onMouseDown={(e) => e.stopPropagation()} className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[130px] py-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={async () => {
                setOpen(false);
                await updateInvoice(invoiceId, {
                  shipmentStatus: s.value,
                  ...(s.value === "entregado" ? { currentLocation: null } : {}),
                });
                router.refresh();
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 ${currentStatus === s.value ? "font-semibold text-primary" : "text-stone-700"}`}
            >
              {s.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export function ShipmentActions({
  invoiceId,
  currentStatus,
  currentLocation,
  currentVehicleId,
  currentBlNumber,
  currentEta,
}: {
  invoiceId: number;
  currentStatus: string;
  currentLocation?: string | null;
  currentVehicleId?: string | null;
  currentBlNumber?: string | null;
  currentEta?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});
  const [status, setStatus] = useState(currentStatus);
  const [location, setLocation] = useState(currentLocation || "");
  const [vehicleId, setVehicleId] = useState(currentVehicleId || "");
  const [blNumber, setBlNumber] = useState(currentBlNumber || "");
  const [eta, setEta] = useState(currentEta || "");
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close when another ShipmentActions opens
  useEffect(() => {
    function handler(e: Event) {
      if ((e as CustomEvent).detail !== invoiceId) setOpen(false);
    }
    document.addEventListener("shipment-panel-open", handler);
    return () => document.removeEventListener("shipment-panel-open", handler);
  }, [invoiceId]);

  function handleOpen(e: React.MouseEvent) {
    setStatus(currentStatus);
    setLocation(currentLocation || "");
    setVehicleId(currentVehicleId || "");
    setBlNumber(currentBlNumber || "");
    setEta(currentEta || "");

    // Compute portal position with flip logic
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const panelW = 260, panelH = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < panelH ? Math.max(8, rect.top - panelH - 6) : rect.bottom + 4;
    const right = window.innerWidth - rect.right;
    setPosStyle({ position: "fixed", top, right: Math.max(4, right), zIndex: 9999, width: panelW });

    // Notify other instances to close
    document.dispatchEvent(new CustomEvent("shipment-panel-open", { detail: invoiceId }));
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      await updateInvoice(invoiceId, {
        shipmentStatus: status as "programado" | "en_transito" | "en_aduana" | "entregado",
        currentLocation: location || null,
        vehicleId: vehicleId || null,
        blNumber: blNumber || null,
        estimatedArrival: eta || null,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={handleOpen} className="text-xs text-primary hover:underline">
        Update
      </button>
      {open && createPortal(
        <div ref={panelRef} style={posStyle} className="bg-white border border-stone-200 rounded-lg shadow-xl p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (e.target.value === "entregado") setLocation("");
              }}
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background">
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
              placeholder="e.g. Laredo, TX" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle ID</label>
            <input value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
              placeholder="e.g. TBOX666789" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">BL Number</label>
            <input value={blNumber} onChange={(e) => setBlNumber(e.target.value)}
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
              placeholder="e.g. BL-12345" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">ETA</label>
            <input type="date" value={eta} onChange={(e) => setEta(e.target.value)}
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={isPending}
              className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1.5 font-medium hover:opacity-90 disabled:opacity-50">
              {isPending ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setOpen(false)}
              className="flex-1 text-xs border border-border rounded px-2 py-1.5 hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
