"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatNumber, formatDate, shipmentStatusLabels, shipmentStatusColors } from "@/lib/utils";
import { ShipmentActions } from "@/components/shipment-actions";
import type { getInvoices } from "@/server/queries";

type InvoiceRow = Awaited<ReturnType<typeof getInvoices>>[number];
type Props = { allInvoices: InvoiceRow[] };

const STATUS_ORDER = ["programado", "en_transito", "en_aduana", "entregado"] as const;

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
                {row.invoice.estimatedArrival ? (
                  formatDate(row.invoice.estimatedArrival)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
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
  const [showDelivered, setShowDelivered] = useState(false);

  const active = allInvoices.filter((r) => r.invoice.shipmentStatus !== "entregado");
  const delivered = allInvoices.filter((r) => r.invoice.shipmentStatus === "entregado");
  const totalActiveTons = active.reduce((s, r) => s + r.invoice.quantityTons, 0);

  const byClient = groupByClient(active);
  const deliveredByClient = groupByClient(delivered);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {active.length} active shipments &middot; {formatNumber(totalActiveTons, 0)} TN in transit
      </p>

      {/* Summary cards — Delivered card is clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_ORDER.map((status) => {
          const rows = allInvoices.filter((r) => r.invoice.shipmentStatus === status);
          const count = rows.length;
          const tons = rows.reduce((s, r) => s + r.invoice.quantityTons, 0);
          const isDelivered = status === "entregado";
          const isSelected = isDelivered && showDelivered;

          return (
            <div
              key={status}
              onClick={isDelivered ? () => setShowDelivered((v) => !v) : undefined}
              className={`bg-white rounded-md shadow-sm p-4 transition-colors ${
                isDelivered
                  ? "cursor-pointer hover:bg-stone-50 ring-1 ring-transparent hover:ring-stone-200"
                  : ""
              } ${isSelected ? "ring-1 ring-primary/30 bg-primary/5" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${shipmentStatusColors[status]}`}>
                  {shipmentStatusLabels[status]}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold">{count}</span>
                  {isDelivered && (
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 transition-transform ${isSelected ? "rotate-180" : ""}`}
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{formatNumber(tons, 0)} TN</p>
            </div>
          );
        })}
      </div>

      {/* Active shipments grouped by client */}
      {Array.from(byClient.entries()).map(([clientName, rows]) => (
        <div key={clientName} className="bg-white rounded-md shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">{clientName}</h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} shipments &middot; {formatNumber(rows.reduce((s, r) => s + r.invoice.quantityTons, 0), 0)} TN
            </span>
          </div>
          <ShipmentsTable rows={rows} />
        </div>
      ))}

      {active.length === 0 && !showDelivered && (
        <div className="bg-white rounded-md shadow-sm p-8 text-center text-muted-foreground">
          No active shipments at this time.
        </div>
      )}

      {/* Delivered shipments — toggled by clicking the Delivered card */}
      {showDelivered && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Delivered ({delivered.length})
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {delivered.length === 0 ? (
            <div className="bg-white rounded-md shadow-sm p-8 text-center text-muted-foreground">
              No delivered shipments.
            </div>
          ) : (
            Array.from(deliveredByClient.entries()).map(([clientName, rows]) => (
              <div key={clientName} className="bg-white rounded-md shadow-sm opacity-90">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="font-semibold">{clientName}</h2>
                  <span className="text-sm text-muted-foreground">
                    {rows.length} shipments &middot; {formatNumber(rows.reduce((s, r) => s + r.invoice.quantityTons, 0), 0)} TN
                  </span>
                </div>
                <ShipmentsTable rows={rows} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
