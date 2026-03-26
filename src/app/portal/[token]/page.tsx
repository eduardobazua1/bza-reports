import { getClientByToken, getClientInvoices, getShipmentUpdates } from "@/server/queries";
import { notFound } from "next/navigation";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";

const statusSteps = ["programado", "en_transito", "en_aduana", "entregado"];

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = statusSteps.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1">
      {statusSteps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-3 h-3 rounded-full ${
              i <= currentIndex ? "bg-primary" : "bg-gray-200"
            }`}
          />
          {i < statusSteps.length - 1 && (
            <div
              className={`w-8 h-0.5 ${
                i < currentIndex ? "bg-primary" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const invoiceData = await getClientInvoices(client.id);
  const active = invoiceData.filter((d) => d.invoice.shipmentStatus !== "entregado");
  const delivered = invoiceData.filter((d) => d.invoice.shipmentStatus === "entregado");

  // Use tracking table view if any invoice has tracking fields
  const hasTrackingData = invoiceData.some(
    (d) => d.invoice.currentLocation || d.invoice.vehicleId || d.invoice.salesDocument
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">BZA International Services</h1>
            <p className="text-sm text-gray-500">Shipment Portal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{client.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ---- KC-style Tracking Table ---- */}
        {hasTrackingData && active.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Shipment Tracking Report</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Current Location</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Last Update</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Purchase Order</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Invoice</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Sales Document</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Vehicle ID</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">BL Number</th>
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">Transport Qty</th>
                    <th className="text-right p-3 font-medium text-gray-600 whitespace-nowrap">Net Price</th>
                    <th className="text-left p-3 font-medium text-gray-600 whitespace-nowrap">Billing Doc.</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((d) => {
                    const price = d.invoice.sellPriceOverride ?? d.poSellPrice ?? 0;
                    return (
                      <tr key={d.invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <span className={
                            d.invoice.currentLocation?.toLowerCase().includes("pending")
                              ? "text-amber-600" : "text-gray-900"
                          }>
                            {d.invoice.currentLocation || "-"}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">{formatDateTime(d.invoice.lastLocationUpdate)}</td>
                        <td className="p-3 font-medium">{d.clientPoNumber || d.poNumber}</td>
                        <td className="p-3">{d.invoice.invoiceNumber}</td>
                        <td className="p-3">{d.invoice.salesDocument || "-"}</td>
                        <td className="p-3 font-mono text-xs">{d.invoice.vehicleId || "-"}</td>
                        <td className="p-3">{d.invoice.blNumber || "-"}</td>
                        <td className="p-3 text-right font-medium">{formatNumber(d.invoice.quantityTons, 3)}</td>
                        <td className="p-3 text-right">{price > 0 ? `$${price}` : "-"}</td>
                        <td className="p-3">{d.invoice.billingDocument || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td className="p-3" colSpan={7}>Total</td>
                    <td className="p-3 text-right">
                      {formatNumber(active.reduce((sum, d) => sum + d.invoice.quantityTons, 0), 3)}
                    </td>
                    <td className="p-3" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ---- Card-based view (default) ---- */}
        {!hasTrackingData && active.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Active Shipments</h2>
            <div className="space-y-4">
              {active.map((d) => (
                <ShipmentCard key={d.invoice.id} data={d} />
              ))}
            </div>
          </section>
        )}

        {active.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">
            No active shipments at this time.
          </div>
        )}

        {delivered.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              Completed Shipments
            </h2>
            <div className="space-y-3">
              {delivered.map((d) => (
                <div
                  key={d.invoice.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{d.invoice.item || d.product}</p>
                    <p className="text-xs text-gray-500">
                      {d.poNumber} &middot; {formatNumber(d.invoice.quantityTons)} TN &middot;{" "}
                      {formatDate(d.invoice.shipmentDate)}
                      {d.invoice.vehicleId && ` · ${d.invoice.vehicleId}`}
                    </p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    Delivered
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-8">
        BZA International Services, LLC &middot; McAllen, TX
      </footer>
    </div>
  );
}

async function ShipmentCard({
  data,
}: {
  data: {
    invoice: {
      id: number;
      invoiceNumber: string;
      quantityTons: number;
      shipmentDate: string | null;
      estimatedArrival: string | null;
      shipmentStatus: string;
      item: string | null;
      currentLocation: string | null;
      vehicleId: string | null;
    };
    poNumber: string | null;
    product: string | null;
    terms: string | null;
    transportType: string | null;
    poSellPrice: number | null;
    clientPoNumber: string | null;
  };
}) {
  const { invoice, poNumber, product, terms, transportType } = data;
  const updates = await getShipmentUpdates(invoice.id);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{invoice.item || product}</h3>
          <p className="text-sm text-gray-500">
            {poNumber} &middot; {invoice.invoiceNumber}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            invoice.shipmentStatus === "en_transito"
              ? "bg-blue-100 text-blue-700"
              : invoice.shipmentStatus === "en_aduana"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {shipmentStatusLabels[invoice.shipmentStatus] || invoice.shipmentStatus}
        </span>
      </div>

      <StatusStepper currentStatus={invoice.shipmentStatus} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Quantity</p>
          <p className="font-medium">{formatNumber(invoice.quantityTons)} TN</p>
        </div>
        <div>
          <p className="text-gray-500">Ship Date</p>
          <p className="font-medium">{formatDate(invoice.shipmentDate)}</p>
        </div>
        <div>
          <p className="text-gray-500">Transport</p>
          <p className="font-medium">
            {transportType ? transportTypeLabels[transportType] || transportType : "-"}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Terms</p>
          <p className="font-medium">{terms || "-"}</p>
        </div>
      </div>

      {updates.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">History</p>
          <div className="space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <span className="text-gray-500">{formatDate(u.createdAt)}</span>
                  {" — "}
                  <span className="font-medium">
                    {shipmentStatusLabels[u.newStatus] || u.newStatus}
                  </span>
                  {u.comment && (
                    <span className="text-gray-500"> &middot; {u.comment}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
