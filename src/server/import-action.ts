"use server";

import { db } from "@/db";
import { clients, suppliers, purchaseOrders, invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

type ParsedRow = {
  poNumber: string;
  poDate: string;
  invoiceNumber: string;
  customer: string;
  customerPO: string;
  quantityTons: number;
  supplier: string;
  sellPrice: number;
  buyPrice: number;
  shipmentDate: string;
  status: string;
  item: string;
  terms: string;
  transportType: string;
};

export async function importExcelData(rows: ParsedRow[]) {
  // Track created entities to avoid duplicates
  const clientMap = new Map<string, number>();
  const supplierMap = new Map<string, number>();
  const poMap = new Map<string, number>();

  let clientsCreated = 0;
  let suppliersCreated = 0;
  let posCreated = 0;
  let invoicesCreated = 0;

  // Pre-load existing clients and suppliers
  const existingClients = await db.select().from(clients);
  for (const c of existingClients) {
    clientMap.set(c.name.toLowerCase(), c.id);
  }

  const existingSuppliers = await db.select().from(suppliers);
  for (const s of existingSuppliers) {
    supplierMap.set(s.name.toLowerCase(), s.id);
  }

  // Pre-load existing POs
  const existingPOs = await db.select().from(purchaseOrders);
  for (const po of existingPOs) {
    poMap.set(po.poNumber.toLowerCase(), po.id);
  }

  // Pre-load existing invoices to skip duplicates
  const existingInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices);
  const existingInvoiceNumbers = new Set(existingInvoices.map((i) => i.invoiceNumber.toLowerCase()));

  for (const row of rows) {
    // 1. Create or find client
    const clientKey = row.customer.toLowerCase();
    if (!clientMap.has(clientKey)) {
      const result = await db
        .insert(clients)
        .values({ name: row.customer, accessToken: uuidv4() })
        .returning();
      clientMap.set(clientKey, result[0].id);
      clientsCreated++;
    }
    const clientId = clientMap.get(clientKey)!;

    // 2. Create or find supplier
    const supplierKey = row.supplier.toLowerCase();
    if (row.supplier && !supplierMap.has(supplierKey)) {
      const result = await db
        .insert(suppliers)
        .values({ name: row.supplier })
        .returning();
      supplierMap.set(supplierKey, result[0].id);
      suppliersCreated++;
    }
    const supplierId = supplierMap.get(supplierKey);
    if (!supplierId) continue; // Skip if no supplier

    // 3. Create or find purchase order
    const poKey = row.poNumber.toLowerCase();
    if (!poMap.has(poKey)) {
      const result = await db
        .insert(purchaseOrders)
        .values({
          poNumber: row.poNumber,
          poDate: row.poDate || undefined,
          clientId,
          clientPoNumber: row.customerPO || undefined,
          supplierId,
          sellPrice: row.sellPrice,
          buyPrice: row.buyPrice,
          product: row.item || "N/A",
          terms: row.terms || undefined,
          transportType: (row.transportType as "ffcc" | "ship" | "truck") || undefined,
        })
        .returning();
      poMap.set(poKey, result[0].id);
      posCreated++;
    }
    const purchaseOrderId = poMap.get(poKey)!;

    // 4. Create invoice (skip duplicates)
    if (row.invoiceNumber && !existingInvoiceNumbers.has(row.invoiceNumber.toLowerCase())) {
      // Map status text to enum values
      let shipmentStatus: "programado" | "en_transito" | "en_aduana" | "entregado" = "programado";
      const statusLower = row.status.toLowerCase();
      if (statusLower.includes("transito") || statusLower.includes("transit")) {
        shipmentStatus = "en_transito";
      } else if (statusLower.includes("aduana") || statusLower.includes("customs")) {
        shipmentStatus = "en_aduana";
      } else if (statusLower.includes("entregado") || statusLower.includes("delivered") || statusLower.includes("completado")) {
        shipmentStatus = "entregado";
      }

      await db.insert(invoices).values({
        invoiceNumber: row.invoiceNumber,
        purchaseOrderId,
        quantityTons: row.quantityTons,
        shipmentDate: row.shipmentDate || undefined,
        shipmentStatus,
        item: row.item || undefined,
      });

      existingInvoiceNumbers.add(row.invoiceNumber.toLowerCase());
      invoicesCreated++;
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/purchase-orders");
  revalidatePath("/invoices");
  revalidatePath("/clients");
  revalidatePath("/suppliers");

  return {
    clients: clientsCreated,
    suppliers: suppliersCreated,
    purchaseOrders: posCreated,
    invoices: invoicesCreated,
  };
}
