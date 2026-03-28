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
      clientPoNumber: purchaseOrders.clientPoNumber,
      product: purchaseOrders.product,
      transportType: purchaseOrders.transportType,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, client.id))
    .orderBy(desc(invoices.shipmentDate))
    .limit(25);

  // Load docs in ONE query
  const invoiceIds = allInvoices.map(i => i.id);
  const allDocs = invoiceIds.length > 0
    ? await db.select({
        id: documents.id,
        invoiceId: documents.invoiceId,
        type: documents.type,
        fileUrl: documents.fileUrl,
      }).from(documents).where(inArray(documents.invoiceId, invoiceIds))
    : [];

  const docsByInvoice = new Map<number, { id: number; type: string; fileUrl: string }[]>();
  for (const doc of allDocs) {
    if (!docsByInvoice.has(doc.invoiceId)) docsByInvoice.set(doc.invoiceId, []);
    docsByInvoice.get(doc.invoiceId)!.push({ id: doc.id, type: doc.type, fileUrl: doc.fileUrl });
  }

  const shipments = allInvoices.map((d) => ({
    id: d.id,
    inv: d.billingDocument || d.invoiceNumber,
    po: d.salesDocument || d.clientPoNumber,
    product: d.item || d.product,
    tons: d.quantityTons,
    date: d.shipmentDate,
    eta: d.estimatedArrival,
    status: d.shipmentStatus,
    loc: d.currentLocation,
    vehicle: d.vehicleId,
    bl: d.blNumber,
    transport: d.transportType,
    docs: docsByInvoice.get(d.id) || [],
  }));

  return (
    <PortalClient
      clientName={client.name}
      shipments={shipments}
    />
  );
}
