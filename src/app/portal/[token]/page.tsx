import { db } from "@/db";
import { clients, invoices, purchaseOrders, documents } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PortalClient } from "./portal-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const client = await db.query.clients.findFirst({
    where: eq(clients.accessToken, token),
  });

  if (!client || !client.portalEnabled) notFound();

  const allInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      quantityTons: invoices.quantityTons,
      shipmentDate: invoices.shipmentDate,
      estimatedArrival: invoices.estimatedArrival,
      shipmentStatus: invoices.shipmentStatus,
      currentLocation: invoices.currentLocation,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      item: invoices.item,
      salesDocument: invoices.salesDocument,
      billingDocument: invoices.billingDocument,
      poNumber: purchaseOrders.poNumber,
      clientPoNumber: purchaseOrders.clientPoNumber,
      product: purchaseOrders.product,
      transportType: purchaseOrders.transportType,
      terms: purchaseOrders.terms,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, client.id))
    .orderBy(desc(invoices.shipmentDate))
    .limit(50);

  // Load ALL documents in ONE query instead of N fetches
  const invoiceIds = allInvoices.map(i => i.id);
  const allDocs = invoiceIds.length > 0
    ? await db.select({
        id: documents.id,
        invoiceId: documents.invoiceId,
        type: documents.type,
        fileName: documents.fileName,
        fileUrl: documents.fileUrl,
      }).from(documents).where(inArray(documents.invoiceId, invoiceIds))
    : [];

  // Group docs by invoiceId
  const docsByInvoice = new Map<number, typeof allDocs>();
  for (const doc of allDocs) {
    if (!docsByInvoice.has(doc.invoiceId)) docsByInvoice.set(doc.invoiceId, []);
    docsByInvoice.get(doc.invoiceId)!.push(doc);
  }

  const shipments = allInvoices.map((d) => ({
    id: d.id,
    invoiceNumber: d.billingDocument || d.invoiceNumber,
    poNumber: d.salesDocument || d.clientPoNumber || d.poNumber,
    clientPoNumber: d.salesDocument || d.clientPoNumber,
    product: d.item || d.product,
    quantityTons: d.quantityTons,
    shipmentDate: d.shipmentDate,
    estimatedArrival: d.estimatedArrival,
    shipmentStatus: d.shipmentStatus,
    currentLocation: d.currentLocation,
    vehicleId: d.vehicleId,
    blNumber: d.blNumber,
    transportType: d.transportType,
    terms: d.terms,
    documents: (docsByInvoice.get(d.id) || []).map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
    })),
  }));

  const poMap = new Map<string, { poNumber: string; clientPo: string; product: string; totalTons: number; invoiceCount: number; status: string; shipments: typeof shipments }>();
  for (const s of shipments) {
    const key = s.clientPoNumber || s.poNumber || "unknown";
    if (!poMap.has(key)) {
      poMap.set(key, { poNumber: key, clientPo: s.clientPoNumber || "-", product: s.product || "-", totalTons: 0, invoiceCount: 0, status: "delivered", shipments: [] });
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
