import { db } from "@/db";
import { clients, suppliers, purchaseOrders, invoices, shipmentUpdates, clientPurchaseOrders, supplierPayments, supplierOrders } from "@/db/schema";
import { eq, desc, sql, and, count } from "drizzle-orm";

// ---- Clients ----
export async function getClients() {
  return db.select().from(clients).orderBy(clients.name);
}

export async function getClient(id: number) {
  return db.query.clients.findFirst({ where: eq(clients.id, id) });
}

// ---- Suppliers ----
export async function getSuppliers() {
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplier(id: number) {
  return db.query.suppliers.findFirst({ where: eq(suppliers.id, id) });
}

// ---- Purchase Orders ----
export async function getPurchaseOrders() {
  return db
    .select({
      po: purchaseOrders,
      clientName: clients.name,
      supplierName: suppliers.name,
      invoiceCount: count(invoices.id),
      totalTons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`,
      totalRevenue: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)`,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice}) + coalesce(${invoices.freightCost}, 0)), 0)`,
    })
    .from(purchaseOrders)
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(invoices, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .groupBy(purchaseOrders.id)
    .orderBy(purchaseOrders.poNumber);
}

export async function getPurchaseOrder(id: number) {
  const po = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, id),
  });
  if (!po) return null;

  const client = await db.query.clients.findFirst({ where: eq(clients.id, po.clientId) });
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) });
  const poInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.purchaseOrderId, id))
    .orderBy(invoices.invoiceNumber);

  const clientPos = await db
    .select()
    .from(clientPurchaseOrders)
    .where(eq(clientPurchaseOrders.purchaseOrderId, id))
    .orderBy(clientPurchaseOrders.clientPoNumber);

  const payments = await db
    .select()
    .from(supplierPayments)
    .where(eq(supplierPayments.purchaseOrderId, id))
    .orderBy(supplierPayments.paymentDate);

  const suppOrders = await db
    .select()
    .from(supplierOrders)
    .where(eq(supplierOrders.purchaseOrderId, id))
    .orderBy(supplierOrders.createdAt);

  return { ...po, client, supplier, invoices: poInvoices, clientPos, payments, supplierOrders: suppOrders };
}

// ---- Invoices ----
export async function getInvoices() {
  return db
    .select({
      invoice: invoices,
      poNumber: purchaseOrders.poNumber,
      clientPoNumber: purchaseOrders.clientPoNumber,
      clientId: purchaseOrders.clientId,
      clientName: clients.name,
      clientEmail: clients.contactEmail,
      clientPaymentTermsDays: clients.paymentTermsDays,
      supplierName: suppliers.name,
      poSellPrice: purchaseOrders.sellPrice,
      poBuyPrice: purchaseOrders.buyPrice,
      product: purchaseOrders.product,
      transportType: purchaseOrders.transportType,
      terms: purchaseOrders.terms,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .orderBy(desc(invoices.shipmentDate));
}

export async function getInvoice(id: number) {
  return db.query.invoices.findFirst({ where: eq(invoices.id, id) });
}

// ---- Shipment Updates ----
export async function getShipmentUpdates(invoiceId: number) {
  return db
    .select()
    .from(shipmentUpdates)
    .where(eq(shipmentUpdates.invoiceId, invoiceId))
    .orderBy(desc(shipmentUpdates.createdAt));
}

// ---- Dashboard KPIs ----
export async function getDashboardKPIs() {
  const allInvoices = await db
    .select({
      quantityTons: invoices.quantityTons,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
      buyPrice: sql<number>`coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})`,
      freightCost: invoices.freightCost,
      customerPaymentStatus: invoices.customerPaymentStatus,
      supplierPaymentStatus: invoices.supplierPaymentStatus,
      shipmentStatus: invoices.shipmentStatus,
      shipmentDate: invoices.shipmentDate,
      dueDate: invoices.dueDate,
      poNumber: purchaseOrders.poNumber,
      clientId: purchaseOrders.clientId,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id));

  let totalRevenue = 0;
  let totalCost = 0;
  let totalTons = 0;
  let unpaidCount = 0;
  let inTransitCount = 0;
  // AR = what clients owe BZA (delivered but not paid)
  let accountsReceivable = 0;
  // AP = what BZA owes suppliers (received/shipped but not paid to supplier)
  let accountsPayable = 0;
  let overdueAR = 0;
  let onTimeAR = 0;
  const today = new Date().toISOString().split("T")[0];

  for (const inv of allInvoices) {
    const revenue = inv.quantityTons * inv.sellPrice;
    const cost = inv.quantityTons * inv.buyPrice + (inv.freightCost || 0);
    totalRevenue += revenue;
    totalCost += cost;
    totalTons += inv.quantityTons;
    if (inv.customerPaymentStatus === "unpaid") {
      unpaidCount++;
      accountsReceivable += revenue;
      if (inv.dueDate && inv.dueDate < today) {
        overdueAR += revenue;
      } else {
        onTimeAR += revenue;
      }
    }
    if (inv.supplierPaymentStatus === "unpaid") {
      accountsPayable += cost;
    }
    if (inv.shipmentStatus === "en_transito" || inv.shipmentStatus === "programado") inTransitCount++;
  }

  const activePOs = await db
    .select({ count: count() })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.status, "active"));

  return {
    totalRevenue,
    totalCost,
    grossProfit: totalRevenue - totalCost,
    grossMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
    totalTons,
    unpaidInvoices: unpaidCount,
    pendingShipments: inTransitCount,
    activePOs: activePOs[0]?.count || 0,
    accountsReceivable,  // clients owe BZA
    accountsPayable,     // BZA owes suppliers
    overdueAR,
    onTimeAR,
  };
}

// ---- Revenue by Year ----
export async function getRevenueByYear() {
  const allInvoices = await db
    .select({
      shipmentDate: invoices.shipmentDate,
      quantityTons: invoices.quantityTons,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
      buyPrice: sql<number>`coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id));

  const byYear: Record<string, { revenue: number; cost: number; tons: number }> = {};
  for (const inv of allInvoices) {
    const year = inv.shipmentDate ? new Date(inv.shipmentDate).getFullYear().toString() : "N/A";
    if (!byYear[year]) byYear[year] = { revenue: 0, cost: 0, tons: 0 };
    byYear[year].revenue += inv.quantityTons * inv.sellPrice;
    byYear[year].cost += inv.quantityTons * inv.buyPrice;
    byYear[year].tons += inv.quantityTons;
  }

  return Object.entries(byYear)
    .map(([year, data]) => ({
      year,
      revenue: Math.round(data.revenue),
      cost: Math.round(data.cost),
      profit: Math.round(data.revenue - data.cost),
      tons: Math.round(data.tons),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

// ---- Profit by Client ----
export async function getProfitByClient() {
  const allInvoices = await db
    .select({
      clientName: clients.name,
      quantityTons: invoices.quantityTons,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
      buyPrice: sql<number>`coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id));

  const byClient: Record<string, { revenue: number; cost: number; tons: number }> = {};
  for (const inv of allInvoices) {
    const name = inv.clientName || "Unknown";
    if (!byClient[name]) byClient[name] = { revenue: 0, cost: 0, tons: 0 };
    byClient[name].revenue += inv.quantityTons * inv.sellPrice;
    byClient[name].cost += inv.quantityTons * inv.buyPrice;
    byClient[name].tons += inv.quantityTons;
  }

  return Object.entries(byClient)
    .map(([client, data]) => ({
      client,
      revenue: Math.round(data.revenue),
      cost: Math.round(data.cost),
      profit: Math.round(data.revenue - data.cost),
      tons: Math.round(data.tons),
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

// ---- Portal: Get client by token ----
export async function getClientByToken(token: string) {
  // Find client by token - check portal enabled separately for Turso compatibility
  const client = await db.query.clients.findFirst({
    where: eq(clients.accessToken, token),
  });
  if (!client || !client.portalEnabled) return null;
  return client;
}

// ---- Portal: Get client invoices ----
export async function getClientInvoices(clientId: number) {
  return db
    .select({
      invoice: invoices,
      poNumber: purchaseOrders.poNumber,
      product: purchaseOrders.product,
      terms: purchaseOrders.terms,
      transportType: purchaseOrders.transportType,
      poSellPrice: purchaseOrders.sellPrice,
      clientPoNumber: purchaseOrders.clientPoNumber,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(desc(invoices.shipmentDate));
}
