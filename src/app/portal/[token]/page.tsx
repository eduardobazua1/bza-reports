import { getClientByToken, getClientInvoices, getShipmentUpdates } from "@/server/queries";
import { notFound } from "next/navigation";
import { formatDate, formatNumber, shipmentStatusLabels, transportTypeLabels } from "@/lib/utils";
import { PortalClient } from "./portal-client";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  const invoiceData = await getClientInvoices(client.id);

  // Build shipment data (no sensitive info)
  const shipments = await Promise.all(invoiceData.map(async (d) => {
    const updates = await getShipmentUpdates(d.invoice.id);
    return {
      id: d.invoice.id,
      invoiceNumber: d.invoice.invoiceNumber,
      poNumber: d.poNumber,
      clientPoNumber: d.invoice.salesDocument || d.clientPoNumber,
      product: d.invoice.item || d.product,
      quantityTons: d.invoice.quantityTons,
      shipmentDate: d.invoice.shipmentDate,
      estimatedArrival: d.invoice.estimatedArrival,
      shipmentStatus: d.invoice.shipmentStatus,
      currentLocation: d.invoice.currentLocation,
      lastLocationUpdate: d.invoice.lastLocationUpdate,
      vehicleId: d.invoice.vehicleId,
      blNumber: d.invoice.blNumber,
      transportType: d.transportType,
      terms: d.terms,
      updates: updates.map(u => ({
        id: u.id,
        date: u.createdAt,
        status: u.newStatus,
      })),
    };
  }));

  // Build PO summary (no cost/margin info)
  const poMap = new Map<string, { poNumber: string; clientPo: string; product: string; totalTons: number; invoiceCount: number; status: string; shipments: typeof shipments }>();
  for (const s of shipments) {
    const key = s.poNumber || "unknown";
    if (!poMap.has(key)) {
      poMap.set(key, {
        poNumber: key,
        clientPo: s.clientPoNumber || "-",
        product: s.product || "-",
        totalTons: 0,
        invoiceCount: 0,
        status: s.shipmentStatus === "entregado" ? "delivered" : "active",
        shipments: [],
      });
    }
    const po = poMap.get(key)!;
    po.totalTons += s.quantityTons;
    po.invoiceCount += 1;
    if (s.shipmentStatus !== "entregado") po.status = "active";
    po.shipments.push(s);
  }
  const purchaseOrders = Array.from(poMap.values());

  return (
    <PortalClient
      clientName={client.name}
      shipments={shipments}
      purchaseOrders={purchaseOrders}
    />
  );
}
