import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

// GET handler for AI-generated download links
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const columns = sp.get("columns")?.split(",").filter(Boolean) || ["poNumber", "invoiceNumber", "quantityTons", "shipmentStatus", "shipmentDate"];
  const clientId = sp.get("clientId") ? Number(sp.get("clientId")) : undefined;
  const year = sp.get("year") || undefined;
  const filter = sp.get("filter") as "active" | "all" | undefined;
  return generateExcel(columns, { year, clientId, filter });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { columns, filters } = body as {
    columns: string[];
    filters?: { year?: string; clientId?: number; supplierId?: number; filter?: "active" | "all" };
  };
  return generateExcel(columns, filters);
}

async function generateExcel(columns: string[], filters?: { year?: string; clientId?: number; supplierId?: number; filter?: "active" | "all" }) {

  // Fetch all invoice data with joins
  let rows = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      poDate: purchaseOrders.poDate,
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      clientPoNumber: purchaseOrders.clientPoNumber,
      supplierName: suppliers.name,
      licenseFsc: purchaseOrders.licenseFsc,
      chainOfCustody: purchaseOrders.chainOfCustody,
      inputClaim: purchaseOrders.inputClaim,
      outputClaim: purchaseOrders.outputClaim,
      quantityTons: invoices.quantityTons,
      unit: invoices.unit,
      sellPrice: purchaseOrders.sellPrice,
      sellPriceOverride: invoices.sellPriceOverride,
      buyPrice: purchaseOrders.buyPrice,
      buyPriceOverride: invoices.buyPriceOverride,
      product: purchaseOrders.product,
      terms: purchaseOrders.terms,
      transportType: purchaseOrders.transportType,
      shipmentDate: invoices.shipmentDate,
      shipmentStatus: invoices.shipmentStatus,
      customerPaymentStatus: invoices.customerPaymentStatus,
      supplierPaymentStatus: invoices.supplierPaymentStatus,
      item: invoices.item,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      salesDocument: invoices.salesDocument,
      billingDocument: invoices.billingDocument,
      invoiceDate: invoices.invoiceDate,
      paymentTermsDays: invoices.paymentTermsDays,
      dueDate: invoices.dueDate,
      customerPaidDate: invoices.customerPaidDate,
      supplierInvoiceNumber: invoices.supplierInvoiceNumber,
      supplierPaidDate: invoices.supplierPaidDate,
      usesFactoring: invoices.usesFactoring,
      notes: invoices.notes,
      currentLocation: invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      estimatedArrival: invoices.estimatedArrival,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  // Apply filters
  if (filters?.year && filters.year !== "all") {
    rows = rows.filter((r) => {
      const date = r.shipmentDate || r.poDate;
      if (!date) return false;
      return new Date(date).getFullYear().toString() === filters.year;
    });
  }
  if (filters?.clientId) {
    const client = await db.query.clients.findFirst({ where: eq(clients.id, filters.clientId) });
    if (client) {
      rows = rows.filter((r) => r.clientName === client.name);
    }
  }
  if (filters?.filter === "active") {
    rows = rows.filter((r) => r.shipmentStatus !== "entregado");
  }

  // Column definitions
  const allColumns: Record<string, { header: string; getValue: (r: typeof rows[0]) => string | number | null }> = {
    currentLocation: { header: "Current Location", getValue: (r) => r.currentLocation },
    lastLocationUpdate: { header: "Last Update", getValue: (r) => r.lastLocationUpdate },
    estimatedArrival: { header: "ETA", getValue: (r) => r.estimatedArrival },
    poNumber: { header: "Purchase Order No.", getValue: (r) => r.poNumber },
    poDate: { header: "Date", getValue: (r) => r.poDate },
    invoiceNumber: { header: "Invoice No.", getValue: (r) => r.invoiceNumber },
    clientName: { header: "Customer", getValue: (r) => r.clientName },
    clientPoNumber: { header: "Customer Purchase Order", getValue: (r) => r.salesDocument || r.clientPoNumber },
    licenseFsc: { header: "License Number", getValue: (r) => r.licenseFsc },
    chainOfCustody: { header: "FSC/PEFC Chain of Custody #", getValue: (r) => r.chainOfCustody },
    inputClaim: { header: "Input (Certificate Claim)", getValue: (r) => r.inputClaim },
    outputClaim: { header: "Output (Certificate Claim)", getValue: (r) => r.outputClaim },
    supplierName: { header: "Supplier", getValue: (r) => r.supplierName },
    quantityTons: { header: "Quantity (TN)", getValue: (r) => r.quantityTons },
    unit: { header: "Unit", getValue: (r) => r.unit },
    sellPrice: { header: "Sell Price", getValue: (r) => r.sellPriceOverride ?? r.sellPrice },
    totalInvoice: { header: "Total Invoice", getValue: (r) => r.quantityTons * (r.sellPriceOverride ?? r.sellPrice ?? 0) },
    buyPrice: { header: "Buy Price (Cost)", getValue: (r) => r.buyPriceOverride ?? r.buyPrice },
    totalCost: { header: "Total Cost", getValue: (r) => r.quantityTons * (r.buyPriceOverride ?? r.buyPrice ?? 0) },
    profit: { header: "Profit", getValue: (r) => {
      const rev = r.quantityTons * (r.sellPriceOverride ?? r.sellPrice ?? 0);
      const cost = r.quantityTons * (r.buyPriceOverride ?? r.buyPrice ?? 0);
      return rev - cost;
    }},
    item: { header: "Item Description", getValue: (r) => r.item },
    product: { header: "Product", getValue: (r) => r.product },
    terms: { header: "Terms", getValue: (r) => r.terms },
    transportType: { header: "Transport Type", getValue: (r) => r.transportType === "ffcc" ? "FFCC" : r.transportType === "ship" ? "Ship" : r.transportType === "truck" ? "Truck" : r.transportType },
    shipmentDate: { header: "Shipment Date", getValue: (r) => r.shipmentDate },
    shipmentStatus: { header: "Shipment Status", getValue: (r) => ({ programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered" }[r.shipmentStatus ?? ""] || r.shipmentStatus) },
    customerPaymentStatus: { header: "Status Customer", getValue: (r) => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid" },
    supplierPaymentStatus: { header: "Status Supplier", getValue: (r) => r.supplierPaymentStatus === "paid" ? "Paid" : "Unpaid" },
    vehicleId: { header: "Vehicle ID", getValue: (r) => r.vehicleId },
    blNumber: { header: "BL Number", getValue: (r) => r.blNumber },
    salesDocument: { header: "Sales Document", getValue: (r) => r.salesDocument },
    billingDocument: { header: "Billing Document", getValue: (r) => r.billingDocument },
    invoiceDate: { header: "Invoice Date", getValue: (r) => r.invoiceDate },
    paymentTermsDays: { header: "Payment Terms (Days)", getValue: (r) => r.paymentTermsDays },
    dueDate: { header: "Due Date", getValue: (r) => r.dueDate },
    customerPaidDate: { header: "Customer Paid Date", getValue: (r) => r.customerPaidDate },
    supplierInvoiceNumber: { header: "Supplier Invoice #", getValue: (r) => r.supplierInvoiceNumber },
    supplierPaidDate: { header: "Supplier Paid Date", getValue: (r) => r.supplierPaidDate },
    usesFactoring: { header: "Factoring", getValue: (r) => r.usesFactoring ? "Yes" : "No" },
    notes: { header: "Notes", getValue: (r) => r.notes },
  };

  // Build selected columns
  const selectedCols = columns.filter((c) => allColumns[c]);

  // Build spreadsheet data
  const headers = selectedCols.map((c) => allColumns[c].header);
  const data = rows.map((r) => selectedCols.map((c) => allColumns[c].getValue(r)));

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Auto-width columns
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...data.map((row) => String(row[i] ?? "").length));
    return { wch: Math.min(maxLen + 2, 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BZA Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BZA_Report_${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
