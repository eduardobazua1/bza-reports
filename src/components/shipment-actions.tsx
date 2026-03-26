"use client";

import { useState, useTransition } from "react";
import { updateInvoice } from "@/server/actions";
import { useRouter } from "next/navigation";

const statuses = [
  { value: "programado", label: "Scheduled" },
  { value: "en_transito", label: "In Transit" },
  { value: "en_aduana", label: "Customs" },
  { value: "entregado", label: "Delivered" },
] as const;

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
  const [status, setStatus] = useState(currentStatus);
  const [location, setLocation] = useState(currentLocation || "");
  const [vehicleId, setVehicleId] = useState(currentVehicleId || "");
  const [blNumber, setBlNumber] = useState(currentBlNumber || "");
  const [eta, setEta] = useState(currentEta || "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Reset state from fresh props every time the form opens
  function handleOpen() {
    setStatus(currentStatus);
    setLocation(currentLocation || "");
    setVehicleId(currentVehicleId || "");
    setBlNumber(currentBlNumber || "");
    setEta(currentEta || "");
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const updates: Record<string, string | null> = {};
      if (status !== currentStatus) updates.shipmentStatus = status;
      // Use null when clearing a field (empty string → null)
      if (location !== (currentLocation || "")) updates.currentLocation = location || null;
      if (vehicleId !== (currentVehicleId || "")) updates.vehicleId = vehicleId || null;
      if (blNumber !== (currentBlNumber || "")) updates.blNumber = blNumber || null;
      if (eta !== (currentEta || "")) updates.estimatedArrival = eta || null;

      if (Object.keys(updates).length > 0) {
        await updateInvoice(invoiceId, updates as Parameters<typeof updateInvoice>[1]);
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="text-xs text-primary hover:underline"
      >
        Update
      </button>
    );
  }

  return (
    <div className="absolute right-2 top-0 z-20 bg-white rounded-md shadow-sm shadow-lg p-3 space-y-2 w-60">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
          placeholder="e.g. Laredo, TX"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Vehicle ID</label>
        <input
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
          placeholder="e.g. TBOX666789"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">BL Number</label>
        <input
          value={blNumber}
          onChange={(e) => setBlNumber(e.target.value)}
          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
          placeholder="e.g. BL-12345"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">ETA</label>
        <input
          type="date"
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 text-xs bg-primary text-primary-foreground rounded px-2 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
          }}
          className="flex-1 text-xs border border-border rounded px-2 py-1.5 hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
