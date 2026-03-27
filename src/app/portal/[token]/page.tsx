import { getClientByToken, getClientInvoices } from "@/server/queries";
import { notFound } from "next/navigation";
import { PortalClient } from "./portal-client";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) notFound();

  let invoiceData;
  try {
    invoiceData = await getClientInvoices(client.id);
  } catch {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100"><p className="text-stone-500">Loading error. Please try again.</p></div>;
  }

  // Build shipment data (no sensitive info, no extra queries)
  const shipments = invoiceData.map((d) => ({
    id: d.invoice.id,
    invoiceNumber: d.invoice.billingDocument || d.invoice.invoiceNumber,
    poNumber: d.invoice.salesDocument || d.clientPoNumber || d.poNumber,
    clientPoNumber: d.invoice.salesDocument || d.clientPoNumber,
    product: d.invoice.item || d.product,
    quantityTons: d.invoice.quantityTons,
    shipmentDate: d.invoice.shipmentDate,
    estimatedArrival: d.invoice.estimatedArrival,
    shipmentStatus: d.invoice.shipmentStatus,
    currentLocation: d.invoice.currentLocation,
    vehicleId: d.invoice.vehicleId,
    blNumber: d.invoice.blNumber,
    transportType: d.transportType,
    terms: d.terms,
  }));

  // Build PO summary grouped by CLIENT PO
  const poMap = new Map<string, {
    poNumber: string; clientPo: string; product: string;
    totalTons: number; invoiceCount: number; status: string;
    shipments: typeof shipments;
  }>();

  for (const s of shipments) {
    const key = s.clientPoNumber || s.poNumber || "unknown";
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

  return (
    <PortalClient
      clientName={client.name}
      shipments={shipments}
      purchaseOrders={Array.from(poMap.values())}
    />
  );
}
