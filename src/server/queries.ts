import { db } from "@/db";
import { clients, suppliers, purchaseOrders, invoices, shipmentUpdates, clientPurchaseOrders, supplierPayments, supplierOrders, customerPayments, customerPaymentInvoices, creditMemos, proposals, proposalItems } from "@/db/schema";
import { eq, desc, sql, and, count, inArray } from "drizzle-orm";

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
      productName: sql<string>`coalesce((SELECT p.name FROM products p WHERE p.id = ${purchaseOrders.supplierProductId}), ${purchaseOrders.product}, '—')`,
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
  // Current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let monthRevenue = 0;
  let monthCost = 0;
  let monthTons = 0;
  let onTimeAR = 0;
  let ar0to30 = 0;
  let ar31to60 = 0;
  let ar61plus = 0;
  let overdueCount = 0;
  let onTimeCount = 0;
  const today = new Date();

  for (const inv of allInvoices) {
    const revenue = inv.quantityTons * inv.sellPrice;
    const cost = inv.quantityTons * inv.buyPrice + (inv.freightCost || 0);
    totalRevenue += revenue;
    totalCost += cost;
    totalTons += inv.quantityTons;
    if (inv.customerPaymentStatus === "unpaid") {
      unpaidCount++;
      accountsReceivable += revenue;
      const todayStr = today.toISOString().split("T")[0];
      if (inv.dueDate) {
        const due = new Date(inv.dueDate);
        const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) {
          overdueAR += revenue;
          overdueCount++;
        } else {
          onTimeAR += revenue;
          onTimeCount++;
          const daysLeft = Math.abs(days);
          if (daysLeft <= 30) ar0to30 += revenue;
          else if (daysLeft <= 60) ar31to60 += revenue;
          else ar61plus += revenue;
        }
      } else {
        onTimeAR += revenue;
        onTimeCount++;
      }
    }
    if (inv.supplierPaymentStatus === "unpaid") {
      accountsPayable += cost;
    }
    if (inv.shipmentStatus === "en_transito" || inv.shipmentStatus === "programado") inTransitCount++;
    if (inv.shipmentDate?.startsWith(currentMonth)) {
      monthRevenue += revenue;
      monthCost += cost;
      monthTons += inv.quantityTons;
    }
  }

  const activePOs = await db
    .select({ count: count() })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.status, "active"));

  const monthByPO = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      clientName: clients.name,
      tons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`,
      revenue: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)`,
      cost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice}) + coalesce(${invoices.freightCost}, 0)), 0)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(sql`${invoices.shipmentDate} LIKE ${currentMonth + "%"}`)
    .groupBy(purchaseOrders.id)
    .orderBy(purchaseOrders.poNumber);

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
    ar0to30,
    ar31to60,
    ar61plus,
    overdueCount,
    onTimeCount,
    monthRevenue,
    monthCost,
    monthProfit: monthRevenue - monthCost,
    monthMargin: monthRevenue > 0 ? ((monthRevenue - monthCost) / monthRevenue) * 100 : 0,
    monthTons,
    monthByPO,
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

// ---- Payments ----
export async function getCustomerPaymentsWithInvoices() {
  const payments = await db
    .select({
      id: customerPayments.id,
      clientId: customerPayments.clientId,
      clientName: clients.name,
      paymentDate: customerPayments.paymentDate,
      amount: customerPayments.amount,
      paymentMethod: customerPayments.paymentMethod,
      referenceNo: customerPayments.referenceNo,
      notes: customerPayments.notes,
      createdAt: customerPayments.createdAt,
    })
    .from(customerPayments)
    .leftJoin(clients, eq(customerPayments.clientId, clients.id))
    .orderBy(desc(customerPayments.paymentDate));

  if (payments.length === 0) return [];

  const links = await db
    .select()
    .from(customerPaymentInvoices)
    .where(inArray(customerPaymentInvoices.paymentId, payments.map(p => p.id)));

  return payments.map(p => ({
    ...p,
    invoices: links.filter(l => l.paymentId === p.id),
  }));
}

export async function getUnpaidInvoicesForPayments() {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      quantityTons: invoices.quantityTons,
      shipmentDate: invoices.shipmentDate,
      dueDate: invoices.dueDate,
      clientId: purchaseOrders.clientId,
      clientName: clients.name,
      poNumber: purchaseOrders.poNumber,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(eq(invoices.customerPaymentStatus, "unpaid"))
    .orderBy(clients.name, invoices.dueDate);
}

export async function getSupplierPaymentsWithInfo() {
  return db
    .select({
      id: supplierPayments.id,
      supplierId: supplierPayments.supplierId,
      supplierName: suppliers.name,
      purchaseOrderId: supplierPayments.purchaseOrderId,
      poNumber: purchaseOrders.poNumber,
      amountUsd: supplierPayments.amountUsd,
      paymentDate: supplierPayments.paymentDate,
      paymentMethod: supplierPayments.paymentMethod,
      reference: supplierPayments.reference,
      notes: supplierPayments.notes,
      estimatedTons: supplierPayments.estimatedTons,
      actualTons: supplierPayments.actualTons,
      adjustmentAmount: supplierPayments.adjustmentAmount,
      adjustmentStatus: supplierPayments.adjustmentStatus,
    })
    .from(supplierPayments)
    .leftJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
    .leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id))
    .orderBy(desc(supplierPayments.paymentDate));
}

// ---- A/P: unpaid supplier invoices ----
export async function getUnpaidSupplierInvoices() {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      quantityTons: invoices.quantityTons,
      shipmentDate: invoices.shipmentDate,
      freightCost: invoices.freightCost,
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      poNumber: purchaseOrders.poNumber,
      clientName: clients.name,
      buyPrice: sql<number>`coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(eq(invoices.supplierPaymentStatus, "unpaid"))
    .orderBy(suppliers.name, invoices.shipmentDate);
}

// ---- Products with sales data ----
export async function getProducts() {
  const { products } = await import("@/db/schema");
  return db.select({ id: products.id, name: products.name, grade: products.grade }).from(products).orderBy(products.name);
}

export async function getProductsWithSales() {
  return db
    .select({
      product: sql<string>`coalesce(${invoices.item}, ${purchaseOrders.product}, 'Unknown')`,
      invoiceCount: count(invoices.id),
      totalTons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`,
      totalRevenue: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)`,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .groupBy(sql`coalesce(${invoices.item}, ${purchaseOrders.product}, 'Unknown')`)
    .orderBy(sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)` );
}

// ---- Credit Memos ----
export async function getCreditMemos() {
  return db
    .select({
      id: creditMemos.id,
      clientId: creditMemos.clientId,
      clientName: clients.name,
      invoiceId: creditMemos.invoiceId,
      creditNumber: creditMemos.creditNumber,
      amount: creditMemos.amount,
      memoDate: creditMemos.memoDate,
      reason: creditMemos.reason,
      status: creditMemos.status,
      appliedDate: creditMemos.appliedDate,
      notes: creditMemos.notes,
      createdAt: creditMemos.createdAt,
    })
    .from(creditMemos)
    .leftJoin(clients, eq(creditMemos.clientId, clients.id))
    .orderBy(desc(creditMemos.memoDate));
}

// ---- Statement: all transactions for a client ----
export async function getClientStatement(clientId: number, fromDate?: string, toDate?: string) {
  const allInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      shipmentDate: invoices.shipmentDate,
      dueDate: invoices.dueDate,
      quantityTons: invoices.quantityTons,
      customerPaymentStatus: invoices.customerPaymentStatus,
      sellPrice: sql<number>`coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})`,
      poNumber: purchaseOrders.poNumber,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(invoices.invoiceDate);

  const allPayments = await db
    .select()
    .from(customerPayments)
    .where(eq(customerPayments.clientId, clientId))
    .orderBy(customerPayments.paymentDate);

  const allCredits = await db
    .select()
    .from(creditMemos)
    .where(eq(creditMemos.clientId, clientId))
    .orderBy(creditMemos.memoDate);

  return { invoices: allInvoices, payments: allPayments, credits: allCredits };
}

// ---- Proposals ----
export async function getProposals() {
  return db
    .select({
      id: proposals.id,
      proposalNumber: proposals.proposalNumber,
      clientId: proposals.clientId,
      clientName: clients.name,
      title: proposals.title,
      proposalDate: proposals.proposalDate,
      validUntil: proposals.validUntil,
      status: proposals.status,
      incoterm: proposals.incoterm,
      paymentTerms: proposals.paymentTerms,
      notes: proposals.notes,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .orderBy(desc(proposals.createdAt));
}

export async function getProposal(id: number) {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.id, id),
  });
  if (!proposal) return null;
  const client = await db.query.clients.findFirst({ where: eq(clients.id, proposal.clientId) });
  const items = await db
    .select()
    .from(proposalItems)
    .where(eq(proposalItems.proposalId, id))
    .orderBy(proposalItems.sort);
  return { ...proposal, client, items };
}

export async function getNextProposalNumber(): Promise<string> {
  const last = await db
    .select({ num: proposals.proposalNumber })
    .from(proposals)
    .orderBy(desc(proposals.id))
    .limit(1);
  if (!last.length) return "PRO-001";
  const match = last[0].num.match(/PRO-(\d+)/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `PRO-${String(next).padStart(3, "0")}`;
}
