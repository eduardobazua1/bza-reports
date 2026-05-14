"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatNumber, formatDate, shipmentStatusLabels, shipmentStatusColors } from "@/lib/utils";
import { ShipmentActions } from "@/components/shipment-actions";
import type { getInvoices } from "@/server/queries";

type InvoiceRow = Awaited<ReturnType<typeof getInvoices>>[number];
type Status = "programado" | "en_transito" | "en_aduana" | "entregado";
type Props = { allInvoices: InvoiceRow[] };

const STATUS_ORDER: Status[] = ["programado", "en_transito", "en_aduana", "entregado"];

function ShipmentsTable({ rows }: { rows: InvoiceRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Status</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Invoice</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">PO</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Client PO</th>
            <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">TN</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Vehicle</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">BL #</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Location</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">ETA</th>
            <th className="text-left px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Ship Date</th>
            <th className="text-center px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.invoice.id} className="hover:bg-muted/30">
              <td className="px-2 py-1.5 border-t border-border">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${shipmentStatusColors[row.invoice.shipmentStatus]}`}>
                  {shipmentStatusLabels[row.invoice.shipmentStatus]}
                </span>
              </td>
              <td className="px-2 py-1.5 border-t border-border font-medium">{row.invoice.invoiceNumber}</td>
              <td className="px-2 py-1.5 border-t border-border">{row.poNumber}</td>
              <td className="px-2 py-1.5 border-t border-border">
                {row.invoice.salesDocument || row.clientPoNumber || <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-2 py-1.5 border-t border-border text-right font-medium">
                {formatNumber(row.invoice.quantityTons, 1)}
              </td>
              <td className="px-2 py-1.5 border-t border-border">
                {row.invoice.vehicleId || <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-2 py-1.5 border-t border-border">
                {row.invoice.blNumber || <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-2 py-1.5 border-t border-border">
                {row.invoice.currentLocation ? (
                  <span className={row.invoice.currentLocation.toLowerCase().includes("pending") ? "text-[#0d3d3b]" : ""}>
                    {row.invoice.currentLocation}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-2 py-1.5 border-t border-border whitespace-nowrap">
                {row.invoice.estimatedArrival ? formatDate(row.invoice.estimatedArrival) : <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-2 py-1.5 border-t border-border whitespace-nowrap">
                {formatDate(row.invoice.shipmentDate)}
              </td>
              <td className="px-2 py-1.5 border-t border-border text-center relative">
                <ShipmentActions
                  invoiceId={row.invoice.id}
                  currentStatus={row.invoice.shipmentStatus}
                  currentLocation={row.invoice.currentLocation}
                  currentVehicleId={row.invoice.vehicleId}
                  currentBlNumber={row.invoice.blNumber}
                  currentEta={row.invoice.estimatedArrival}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupByClient(rows: InvoiceRow[]) {
  const map = new Map<string, InvoiceRow[]>();
  for (const row of rows) {
    const name = row.clientName || "No client";
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(row);
  }
  return map;
}

export function ShipmentsClient({ allInvoices }: Props) {
  // null = show all active (non-delivered); a status = show only that status
  const [filter, setFilter] = useState<Status | null>(null);

  const active = allInvoices.filter((r) => r.invoice.shipmentStatus !== "entregado");
  const totalActiveTons = active.reduce((s, r) => s + r.invoice.quantityTons, 0);

  // Which rows to display in the table section
  const displayRows = filter
    ? allInvoices.filter((r) => r.invoice.shipmentStatus === filter)
    : active;

  const byClient = groupByClient(displayRows);

  function toggleFilter(status: Status) {
    setFilter((prev) => (prev === status ? null : status));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {active.length} active shipments &middot; {formatNumber(totalActiveTons, 0)} TN in transit
      </p>

      {/* Summary cards — all clickable as filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_ORDER.map((status) => {
          const rows = allInvoices.filter((r) => r.invoice.shipmentStatus === status);
          const count = rows.length;
          const tons = rows.reduce((s, r) => s + r.invoice.quantityTons, 0);
          const isSelected = filter === status;

          return (
            <div
              key={status}
              onClick={() => toggleFilter(status)}
              className={`bg-white rounded-md shadow-sm p-4 cursor-pointer transition-all hover:bg-stone-50 ring-1 ${
                isSelected
                  ? "ring-primary/40 bg-primary/5"
                  : "ring-transparent hover:ring-stone-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${shipmentStatusColors[status]}`}>
                  {shipmentStatusLabels[status]}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold">{count}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-400 transition-transform ${isSelected ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{formatNumber(tons, 0)} TN</p>
            </div>
          );
        })}
      </div>

      {/* Filter label */}
      {filter && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {shipmentStatusLabels[filter]} ({displayRows.length})
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Shipments table grouped by client */}
      {Array.from(byClient.entries()).map(([clientName, rows]) => (
        <div key={clientName} className={`bg-white rounded-md shadow-sm ${filter === "entregado" ? "opacity-90" : ""}`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">{clientName}</h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} shipments &middot; {formatNumber(rows.reduce((s, r) => s + r.invoice.quantityTons, 0), 0)} TN
            </span>
          </div>
          <ShipmentsTable rows={rows} />
        </div>
      ))}

      {displayRows.length === 0 && (
        <div className="bg-white rounded-md shadow-sm p-8 text-center text-muted-foreground">
          {filter ? `No shipments with status "${shipmentStatusLabels[filter]}".` : "No active shipments at this time."}
        </div>
      )}
    </div>
  );
}
