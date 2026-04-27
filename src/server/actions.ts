"use server";

import { db } from "@/db";
import { clients, suppliers, purchaseOrders, invoices, shipmentUpdates, supplierPayments, products, customerPayments, customerPaymentInvoices } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

// ---- Clients ----
export async function createClient(data: {
  name: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  billAddress?: string;
  shipAddress?: string;
  rfc?: string;
  city?: string;
  country?: string;
}) {
  await db.insert(clients).values({
    ...data,
    accessToken: uuidv4(),
  });
  revalidatePath("/clients");
}

export async function updateClient(id: number, data: {
  name: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  portalEnabled?: boolean;
  paymentTermsDays?: number | null;
  billAddress?: string;
  shipAddress?: string;
  rfc?: string;
  city?: string;
  country?: string;
  certType?: string | null;
  fscLicense?: string | null;
  fscChainOfCustody?: string | null;
  fscInputClaim?: string | null;
  fscOutputClaim?: string | null;
  pefc?: string | null;
}) {
  await db.update(clients).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(clients.id, id));
  revalidatePath("/clients");
}

export async function deleteClient(id: number) {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/clients");
}

// ---- Suppliers ----
type SupplierData = {
  name: string;
  country?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  website?: string;
  notes?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  bankName?: string;
  bankBeneficiary?: string;
  bankAccount?: string;
  bankRouting?: string;
  bankSwift?: string;
  bankAddress?: string;
  certType?: string;
  fscLicense?: string;
  fscChainOfCustody?: string;
  fscInputClaim?: string;
  fscOutputClaim?: string;
  pefc?: string;
};

export async function createSupplier(data: SupplierData) {
  await db.insert(suppliers).values(data);
  revalidatePath("/suppliers");
}

export async function updateSupplier(id: number, data: SupplierData) {
  await db.update(suppliers).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(suppliers.id, id));
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

export async function deleteSupplier(id: number) {
  await db.delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath("/suppliers");
}

// ---- Purchase Orders ----
export async function createPurchaseOrder(data: {
  poNumber: string;
  poDate?: string;
  clientId: number;
  clientPoNumber?: string;
  supplierId: number;
  sellPrice: number;
  buyPrice: number;
  product: string;
  supplierProductId?: number;
  clientProductId?: number;
  terms?: string;
  transportType?: "ffcc" | "ship" | "truck";
  licenseFsc?: string;
  chainOfCustody?: string;
  inputClaim?: string;
  outputClaim?: string;
  certType?: "fsc" | "pefc";
  pefc?: string;
  notes?: string;
}) {
  const result = await db.insert(purchaseOrders).values(data).returning();
  revalidatePath("/purchase-orders");
  return result[0];
}

export async function updatePurchaseOrder(id: number, data: Partial<{
  poNumber: string;
  poDate: string;
  clientId: number;
  clientPoNumber: string;
  supplierId: number;
  sellPrice: number;
  buyPrice: number;
  product: string;
  supplierProductId: number | null;
  clientProductId: number | null;
  terms: string;
  transportType: "ffcc" | "ship" | "truck";
  licenseFsc: string;
  chainOfCustody: string;
  inputClaim: string;
  outputClaim: string;
  certType: "fsc" | "pefc";
  pefc: string;
  status: "active" | "completed" | "cancelled";
  notes: string;
}>) {
  await db.update(purchaseOrders).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(purchaseOrders.id, id));
  revalidatePath("/purchase-orders");
}

export async function deletePurchaseOrder(id: number) {
  // Delete shipment updates for all invoices of this PO
  const invs = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.purchaseOrderId, id));
  for (const inv of invs) {
    await db.delete(shipmentUpdates).where(eq(shipmentUpdates.invoiceId, inv.id));
  }
  await db.delete(invoices).where(eq(invoices.purchaseOrderId, id));
  await db.delete(supplierPayments).where(eq(supplierPayments.purchaseOrderId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  revalidatePath("/purchase-orders");
}

// ---- Helper: auto-calculate due date from shipment date + client payment terms ----
async function calcDueDate(purchaseOrderId: number, shipmentDate?: string | null): Promise<{ dueDate?: string; paymentTermsDays?: number }> {
  if (!shipmentDate) return {};
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, purchaseOrderId) });
  if (!po) return {};
  const client = await db.query.clients.findFirst({ where: eq(clients.id, po.clientId) });
  if (!client?.paymentTermsDays) return {};
  const parts = shipmentDate.split("-");
  const ship = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  ship.setDate(ship.getDate() + client.paymentTermsDays);
  const y = ship.getFullYear();
  const m = String(ship.getMonth() + 1).padStart(2, "0");
  const d = String(ship.getDate()).padStart(2, "0");
  return { dueDate: `${y}-${m}-${d}`, paymentTermsDays: client.paymentTermsDays };
}

// ---- Invoices ----
export async function createInvoice(data: {
  invoiceNumber: string;
  purchaseOrderId: number;
  quantityTons: number;
  unit?: string;
  sellPriceOverride?: number;
  buyPriceOverride?: number;
  shipmentDate?: string;
  invoiceDate?: string;
  estimatedArrival?: string;
  dueDate?: string;
  paymentTermsDays?: number;
  shipmentStatus?: "programado" | "en_transito" | "en_aduana" | "entregado";
  customerPaymentStatus?: "paid" | "unpaid";
  supplierPaymentStatus?: "paid" | "unpaid";
  usesFactoring?: boolean;
  item?: string;
  vehicleId?: string;
  blNumber?: string;
  currentLocation?: string;
  destination?: string;
  balesCount?: number;
  unitsPerBale?: number;
  salesDocument?: string;
  billingDocument?: string;
  notes?: string;
}) {
  // Auto-calculate due date from client payment terms
  const dueDateCalc = await calcDueDate(data.purchaseOrderId, data.shipmentDate);
  const result = await db.insert(invoices).values({ ...data, ...dueDateCalc }).returning();
  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
  return result[0];
}

export async function updateInvoice(id: number, data: Partial<{
  invoiceNumber: string;
  quantityTons: number;
  sellPriceOverride: number;
  buyPriceOverride: number;
  shipmentDate: string;
  invoiceDate: string;
  estimatedArrival: string | null;
  dueDate: string;
  paymentTermsDays: number;
  shipmentStatus: "programado" | "en_transito" | "en_aduana" | "entregado";
  customerPaymentStatus: "paid" | "unpaid";
  supplierPaymentStatus: "paid" | "unpaid";
  usesFactoring: boolean;
  factoringAmount: number;
  factoringDays: number;
  factoringCost: number;
  item: string;
  notes: string;
  currentLocation: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  destination: string | null;
  balesCount: number | null;
  unitsPerBale: number | null;
  salesDocument: string | null;
  billingDocument: string | null;
}>) {
  // If shipment status changed, create a shipment update
  if (data.shipmentStatus) {
    const current = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (current && current.shipmentStatus !== data.shipmentStatus) {
      await db.insert(shipmentUpdates).values({
        invoiceId: id,
        previousStatus: current.shipmentStatus,
        newStatus: data.shipmentStatus,
      });
    }
  }

  // Auto-set lastLocationUpdate when location changes
  const updates: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
  if (data.currentLocation !== undefined) {
    updates.lastLocationUpdate = new Date().toISOString();
  }

  // Auto-recalculate due date if shipment date changes
  if (data.shipmentDate) {
    const current = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (current) {
      const dueDateCalc = await calcDueDate(current.purchaseOrderId, data.shipmentDate);
      if (dueDateCalc.dueDate) {
        updates.dueDate = dueDateCalc.dueDate;
        updates.paymentTermsDays = dueDateCalc.paymentTermsDays;
      }
    }
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, id));

  // Auto-complete PO if all invoices for this PO are now delivered
  if (data.shipmentStatus === "entregado") {
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
    if (inv) {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, inv.purchaseOrderId) });
      if (po && po.status === "active") {
        const nonDelivered = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(
            eq(invoices.purchaseOrderId, inv.purchaseOrderId),
            ne(invoices.shipmentStatus, "entregado")
          ));
        if (nonDelivered.length === 0) {
          await db.update(purchaseOrders)
            .set({ status: "completed", updatedAt: new Date().toISOString() })
            .where(eq(purchaseOrders.id, inv.purchaseOrderId));
        }
      }
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
  revalidatePath("/shipments");
}

export async function markInvoicesPaid(
  ids: number[],
  paidDate: string,
  paymentMethod: string,
  referenceNo: string,
  clientId: number,
  invoiceAmounts: { id: number; invoiceNumber: string; amount: number }[]
) {
  // Create the payment record
  const [payment] = await db
    .insert(customerPayments)
    .values({
      clientId,
      paymentDate: paidDate,
      amount: invoiceAmounts.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.amount, 0),
      paymentMethod,
      referenceNo: referenceNo || null,
    })
    .returning({ id: customerPayments.id });

  // Link invoices to the payment
  for (const inv of invoiceAmounts.filter((i) => ids.includes(i.id))) {
    await db.insert(customerPaymentInvoices).values({
      paymentId: payment.id,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
    });
    // Mark invoice paid
    await db
      .update(invoices)
      .set({ customerPaymentStatus: "paid", customerPaidDate: paidDate })
      .where(eq(invoices.id, inv.id));
  }

  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
}

export async function markInvoiceUnpaid(id: number) {
  await db.update(invoices).set({ customerPaymentStatus: "unpaid" }).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
  revalidatePath("/reports/financial");
}

export async function deleteInvoice(id: number) {
  await db.delete(shipmentUpdates).where(eq(shipmentUpdates.invoiceId, id));
  await db.delete(invoices).where(eq(invoices.id, id));
  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
}

export async function duplicateInvoice(id: number) {
  const [orig] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!orig) return;
  const newNumber = `PEND-COPY-${Date.now().toString().slice(-6)}`;
  await db.insert(invoices).values({
    invoiceNumber: newNumber,
    purchaseOrderId: orig.purchaseOrderId,
    quantityTons: orig.quantityTons,
    unit: orig.unit,
    sellPriceOverride: orig.sellPriceOverride,
    buyPriceOverride: orig.buyPriceOverride,
    shipmentDate: orig.shipmentDate,
    estimatedArrival: orig.estimatedArrival,
    shipmentStatus: "programado",
    customerPaymentStatus: "unpaid",
    supplierPaymentStatus: "unpaid",
    usesFactoring: orig.usesFactoring,
    freightCost: orig.freightCost,
    item: orig.item,
    notes: orig.notes,
    destination: orig.destination,
    vehicleId: orig.vehicleId,
    blNumber: orig.blNumber,
    currentLocation: orig.currentLocation,
    balesCount: orig.balesCount,
    unitsPerBale: orig.unitsPerBale,
  });
  revalidatePath("/invoices");
  revalidatePath("/purchase-orders");
}

// ---- Products ----
export async function createProduct(data: {
  name: string;
  grade?: string;
  description?: string;
  fscLicense?: string;
  chainOfCustody?: string;
  inputClaim?: string;
  outputClaim?: string;
  pefc?: string;
  notes?: string;
}) {
  await db.insert(products).values({ ...data, updatedAt: new Date().toISOString() });
  revalidatePath("/products");
}

export async function updateProduct(id: number, data: {
  name: string;
  grade?: string;
  description?: string;
  fscLicense?: string;
  chainOfCustody?: string;
  inputClaim?: string;
  outputClaim?: string;
  pefc?: string;
  notes?: string;
}) {
  await db.update(products).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(products.id, id));
  revalidatePath("/products");
}

export async function deleteProduct(id: number) {
  await db.delete(products).where(eq(products.id, id));
  revalidatePath("/products");
}
