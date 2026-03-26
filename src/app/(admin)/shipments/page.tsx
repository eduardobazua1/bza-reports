import { getInvoices } from "@/server/queries";
import { formatNumber, formatDate, shipmentStatusLabels, shipmentStatusColors } from "@/lib/utils";
import { ShipmentActions } from "@/components/shipment-actions";

export default async function ShipmentsPage() {
  const allInvoices = await getInvoices();

  const active = allInvoices.filter((r) => r.invoice.shipmentStatus !== "entregado");
  const delivered = allInvoices.filter((r) => r.invoice.shipmentStatus === "entregado");

  // Group active by client
  const byClient = new Map<string, typeof active>();
  for (const row of active) {
    const name = row.clientName || "No client";
    if (!byClient.has(name)) byClient.set(name, []);
    byClient.get(name)!.push(row);
  }

  const totalActiveTons = active.reduce((s, r) => s + r.invoice.quantityTons, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Active Shipments</h1>
          <p className="text-sm text-muted-foreground">
            {active.length} shipments &middot; {formatNumber(totalActiveTons, 0)} TN in transit
          </p>
        </div>
      </div>

      {/* Summary cards by status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["programado", "en_transito", "en_aduana", "entregado"] as const).map((status) => {
          const count = status === "entregado"
            ? delivered.length
            : active.filter((r) => r.invoice.shipmentStatus === status).length;
          const tons = status === "entregado"
            ? delivered.reduce((s, r) => s + r.invoice.quantityTons, 0)
            : active.filter((r) => r.invoice.shipmentStatus === status).reduce((s, r) => s + r.invoice.quantityTons, 0);
          return (
            <div key={status} className="bg-white rounded-md shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${shipmentStatusColors[status]}`}>
                  {shipmentStatusLabels[status]}
                </span>
                <span className="text-lg font-bold">{count}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
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
                    <td className="px-2 py-1.5 border-t border-border">{row.invoice.salesDocument || row.clientPoNumber || <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-2 py-1.5 border-t border-border text-right font-medium">
                      {formatNumber(row.invoice.quantityTons, 1)}
                    </td>
                    <td className="px-2 py-1.5 border-t border-border font-mono">
                      {row.invoice.vehicleId || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-2 py-1.5 border-t border-border font-mono">
                      {row.invoice.blNumber || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-2 py-1.5 border-t border-border">
                      {row.invoice.currentLocation ? (
                        <span className={row.invoice.currentLocation.toLowerCase().includes("pending") ? "text-amber-600" : ""}>
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
                    <td className="px-2 py-1.5 border-t border-border whitespace-nowrap">{formatDate(row.invoice.shipmentDate)}</td>
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
        </div>
      ))}

      {active.length === 0 && (
        <div className="bg-white rounded-md shadow-sm p-8 text-center text-muted-foreground">
          No active shipments at this time.
        </div>
      )}
    </div>
  );
}
