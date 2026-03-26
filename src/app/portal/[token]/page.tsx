import { getClientByToken, getClientInvoices, getShipmentUpdates } from "@/server/queries";
import { notFound } from "next/navigation";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";

const statusSteps = [
  { key: "programado", label: "Scheduled", icon: "📋" },
  { key: "en_transito", label: "In Transit", icon: "🚂" },
  { key: "en_aduana", label: "Customs", icon: "🏛" },
  { key: "entregado", label: "Delivered", icon: "✓" },
];

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = statusSteps.findIndex(s => s.key === currentStatus);

  return (
    <div className="flex items-center justify-between w-full">
      {statusSteps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i <= currentIndex
                ? i === currentIndex ? "bg-blue-500 text-white" : "bg-emerald-500 text-white"
                : "bg-stone-200 text-stone-400"
            }`}>
              {i < currentIndex ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] mt-1 ${i <= currentIndex ? "text-stone-700 font-medium" : "text-stone-400"}`}>
              {step.label}
            </span>
          </div>
          {i < statusSteps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mt-[-16px] ${i < currentIndex ? "bg-emerald-500" : "bg-stone-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
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
  const totalActiveTons = active.reduce((s, d) => s + d.invoice.quantityTons, 0);

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/bza-logo-new.png" alt="BZA" className="h-7" />
          <div className="text-right">
            <p className="text-sm font-medium text-stone-800">{client.name}</p>
            <p className="text-[10px] text-stone-400">Shipment Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Summary card */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide">Active Shipments</p>
              <p className="text-2xl font-bold text-stone-900">{active.length}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 uppercase tracking-wide">Total Volume</p>
              <p className="text-2xl font-bold text-stone-900">{formatNumber(totalActiveTons, 0)} <span className="text-sm font-normal text-stone-400">TN</span></p>
            </div>
          </div>
        </div>

        {/* Active shipments */}
        {active.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Active</h2>
            {active.map((d) => (
              <ShipmentCard key={d.invoice.id} data={d} />
            ))}
          </div>
        )}

        {active.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-stone-400">No active shipments</p>
          </div>
        )}

        {/* Delivered */}
        {delivered.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
              Delivered ({delivered.length})
            </h2>
            {delivered.slice(0, 10).map((d) => (
              <div key={d.invoice.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">
                    {d.invoice.item || d.product}
                  </p>
                  <p className="text-xs text-stone-400">
                    {d.invoice.salesDocument || d.clientPoNumber || d.poNumber} · {formatNumber(d.invoice.quantityTons, 1)} TN · {formatDate(d.invoice.shipmentDate)}
                  </p>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full ml-2 shrink-0">
                  Delivered
                </span>
              </div>
            ))}
            {delivered.length > 10 && (
              <p className="text-xs text-center text-stone-400">and {delivered.length - 10} more...</p>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-stone-300 py-6">
        BZA International Services, LLC · McAllen, TX
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
      lastLocationUpdate: string | null;
      vehicleId: string | null;
      blNumber: string | null;
      salesDocument: string | null;
      billingDocument: string | null;
      sellPriceOverride: number | null;
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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-900 truncate">{invoice.item || product}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {invoice.salesDocument || data.clientPoNumber || poNumber} · {invoice.invoiceNumber}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ml-2 shrink-0 font-medium ${
            invoice.shipmentStatus === "en_transito" ? "bg-blue-50 text-blue-600" :
            invoice.shipmentStatus === "en_aduana" ? "bg-amber-50 text-amber-600" :
            invoice.shipmentStatus === "entregado" ? "bg-emerald-50 text-emerald-600" :
            "bg-stone-100 text-stone-500"
          }`}>
            {shipmentStatusLabels[invoice.shipmentStatus] || invoice.shipmentStatus}
          </span>
        </div>

        {/* Status stepper */}
        <StatusStepper currentStatus={invoice.shipmentStatus} />
      </div>

      {/* Details grid */}
      <div className="px-4 py-3 bg-stone-50 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-stone-400">Quantity</p>
          <p className="font-semibold text-stone-800">{formatNumber(invoice.quantityTons, 1)} TN</p>
        </div>
        <div>
          <p className="text-stone-400">Ship Date</p>
          <p className="font-semibold text-stone-800">{formatDate(invoice.shipmentDate)}</p>
        </div>
        {invoice.vehicleId && (
          <div>
            <p className="text-stone-400">Vehicle / Railcar</p>
            <p className="font-semibold text-stone-800 font-mono text-[11px]">{invoice.vehicleId}</p>
          </div>
        )}
        {invoice.blNumber && (
          <div>
            <p className="text-stone-400">BL Number</p>
            <p className="font-semibold text-stone-800">{invoice.blNumber}</p>
          </div>
        )}
        {invoice.currentLocation && (
          <div>
            <p className="text-stone-400">Location</p>
            <p className="font-semibold text-stone-800">{invoice.currentLocation}</p>
          </div>
        )}
        {invoice.estimatedArrival && (
          <div>
            <p className="text-stone-400">ETA</p>
            <p className="font-semibold text-stone-800">{formatDate(invoice.estimatedArrival)}</p>
          </div>
        )}
        {transportType && (
          <div>
            <p className="text-stone-400">Transport</p>
            <p className="font-semibold text-stone-800">{transportTypeLabels[transportType] || transportType}</p>
          </div>
        )}
        {terms && (
          <div>
            <p className="text-stone-400">Terms</p>
            <p className="font-semibold text-stone-800">{terms}</p>
          </div>
        )}
      </div>

      {/* History */}
      {updates.length > 0 && (
        <div className="px-4 py-3 border-t border-stone-100">
          <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mb-2">History</p>
          <div className="space-y-1.5">
            {updates.slice(0, 3).map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-xs">
                <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                <span className="text-stone-400">{formatDate(u.createdAt)}</span>
                <span className="text-stone-600 font-medium">{shipmentStatusLabels[u.newStatus] || u.newStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
