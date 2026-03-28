import { db } from "@/db";
import { clients, invoices, purchaseOrders, documents } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const client = await db.query.clients.findFirst({
    where: eq(clients.accessToken, token),
  });

  if (!client || !client.portalEnabled) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const rows = await db
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
    .limit(30);

  const ids = rows.map(r => r.id);
  const allDocs = ids.length > 0
    ? await db.select({ id: documents.id, invoiceId: documents.invoiceId, type: documents.type })
        .from(documents).where(inArray(documents.invoiceId, ids))
    : [];

  const docMap = new Map<number, { id: number; type: string }[]>();
  for (const d of allDocs) {
    if (!docMap.has(d.invoiceId)) docMap.set(d.invoiceId, []);
    docMap.get(d.invoiceId)!.push({ id: d.id, type: d.type });
  }

  const shipments = rows.map(r => ({
    id: r.id,
    inv: r.billingDocument || r.invoiceNumber,
    po: r.salesDocument || r.clientPoNumber,
    product: r.item || r.product,
    tons: r.quantityTons,
    date: r.shipmentDate,
    eta: r.estimatedArrival,
    status: r.shipmentStatus,
    loc: r.currentLocation,
    vehicle: r.vehicleId,
    bl: r.blNumber,
    transport: r.transportType,
    docs: (docMap.get(r.id) || []).map(d => ({ id: d.id, type: d.type })),
  }));

  return NextResponse.json({ name: client.name, shipments });
}
