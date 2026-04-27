import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { createClient } from "@libsql/client";
import { invoices, purchaseOrders, clients, suppliers, supplierPayments, scheduledReports, reportTemplates, shipmentUpdates, marketPrices } from "@/db/schema";
import { eq, sql, count, like, desc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "query_data", description: "Query business data: summary, clients, suppliers, POs, invoices, payments, shipments", parameters: { type: "object", properties: { query_type: { type: "string", enum: ["summary", "unpaid_invoices", "active_pos", "all_pos", "client_list", "supplier_list", "supplier_payments", "active_shipments", "templates", "scheduled_reports"] }, filter_name: { type: "string" } }, required: ["query_type"] } } },
  { type: "function", function: { name: "create_po", description: "Create purchase order", parameters: { type: "object", properties: { poNumber: { type: "string" }, clientName: { type: "string" }, supplierName: { type: "string" }, sellPrice: { type: "number" }, buyPrice: { type: "number" }, product: { type: "string" }, poDate: { type: "string" }, terms: { type: "string" }, transportType: { type: "string", enum: ["ffcc", "ship", "truck"] }, licenseFsc: { type: "string" }, chainOfCustody: { type: "string" }, inputClaim: { type: "string" }, outputClaim: { type: "string" } }, required: ["poNumber", "clientName", "supplierName", "sellPrice", "buyPrice", "product"] } } },
  { type: "function", function: { name: "create_invoice", description: "Create invoice/shipment on a PO", parameters: { type: "object", properties: { invoiceNumber: { type: "string" }, poNumber: { type: "string" }, quantityTons: { type: "number" }, item: { type: "string" }, shipmentDate: { type: "string" }, vehicleId: { type: "string", description: "Tracking/railcar number e.g. TBOX640169" }, blNumber: { type: "string" }, currentLocation: { type: "string", description: "Current location for tracking" }, destination: { type: "string", description: "Final destination e.g. Ecatepec, Morelia, Bajio" }, balesCount: { type: "number", description: "Number of bales (from BOL)" }, unitsPerBale: { type: "number", description: "Units per bale (from BOL)" }, invoiceDate: { type: "string" }, salesDocument: { type: "string" }, billingDocument: { type: "string" } }, required: ["invoiceNumber", "poNumber", "quantityTons"] } } },
  { type: "function", function: { name: "update_invoice", description: "Update invoice fields. Can find the invoice by ANY of: invoiceNumber, vehicleIdLookup (railcar/container), blNumberLookup (BL number), or salesDocumentLookup (client PO). When processing shipment status updates from documents, always use vehicleIdLookup with the railcar number.", parameters: { type: "object", properties: { invoiceNumber: { type: "string", description: "Invoice # (e.g. IX0043-1)" }, vehicleIdLookup: { type: "string", description: "Railcar or container # to look up the invoice (e.g. TBOX640169, RAIL123456)" }, blNumberLookup: { type: "string", description: "BL (Bill of Lading) number to look up the invoice" }, salesDocumentLookup: { type: "string", description: "Client PO / sales document number to look up the invoice" }, quantityTons: { type: "number" }, customerPaymentStatus: { type: "string", enum: ["paid", "unpaid"] }, supplierPaymentStatus: { type: "string", enum: ["paid", "unpaid"] }, shipmentStatus: { type: "string", enum: ["programado", "en_transito", "en_aduana", "entregado"] }, shipmentDate: { type: "string" }, currentLocation: { type: "string" }, destination: { type: "string" }, vehicleId: { type: "string" }, blNumber: { type: "string" }, estimatedArrival: { type: "string" }, customerPaidDate: { type: "string" }, invoiceDate: { type: "string" }, paymentTermsDays: { type: "number" }, salesDocument: { type: "string" }, billingDocument: { type: "string" }, balesCount: { type: "number" }, unitsPerBale: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "update_po", description: "Update PO: status, prices, dates, product, certification", parameters: { type: "object", properties: { poNumber: { type: "string" }, status: { type: "string", enum: ["active", "completed", "cancelled"] }, product: { type: "string" }, sellPrice: { type: "number" }, buyPrice: { type: "number" }, poDate: { type: "string" }, terms: { type: "string" }, transportType: { type: "string", enum: ["ffcc", "ship", "truck"] }, licenseFsc: { type: "string" }, chainOfCustody: { type: "string" }, inputClaim: { type: "string" }, outputClaim: { type: "string" }, notes: { type: "string" } }, required: ["poNumber"] } } },
  { type: "function", function: { name: "create_supplier_payment", description: "Record a payment to a supplier (advance, wire, deposit)", parameters: { type: "object", properties: { supplierName: { type: "string" }, amountUsd: { type: "number" }, paymentDate: { type: "string" }, estimatedTons: { type: "number" }, pricePerTon: { type: "number" }, poNumber: { type: "string" }, reference: { type: "string" }, notes: { type: "string" } }, required: ["supplierName", "amountUsd", "paymentDate"] } } },
  { type: "function", function: { name: "create_client", description: "Create a new client", parameters: { type: "object", properties: { name: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "update_client", description: "Update client info including FSC/PEFC certification fields", parameters: { type: "object", properties: { clientName: { type: "string" }, fscLicense: { type: "string" }, fscChainOfCustody: { type: "string" }, fscInputClaim: { type: "string" }, fscOutputClaim: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" }, paymentTermsDays: { type: "number" } }, required: ["clientName"] } } },
  { type: "function", function: { name: "create_supplier", description: "Create a new supplier", parameters: { type: "object", properties: { name: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "update_supplier", description: "Update supplier info including FSC/PEFC certification fields", parameters: { type: "object", properties: { supplierName: { type: "string" }, fscLicense: { type: "string" }, fscChainOfCustody: { type: "string" }, fscInputClaim: { type: "string" }, fscOutputClaim: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" } }, required: ["supplierName"] } } },
  { type: "function", function: { name: "delete_record", description: "Delete a PO, invoice, client, supplier, or payment", parameters: { type: "object", properties: { type: { type: "string", enum: ["po", "invoice", "client", "supplier", "payment"] }, identifier: { type: "string", description: "PO number, invoice number, client name, supplier name, or payment ID" } }, required: ["type", "identifier"] } } },
  { type: "function", function: { name: "update_shipment_tracking", description: "Update location, ETA, and status for one or more railcars/containers using their vehicle IDs. Use this ALWAYS when processing tracking screenshots, emails, or reports. Pass all vehicles at once in the updates array.", parameters: { type: "object", properties: { updates: { type: "array", description: "List of railcar updates extracted from the document", items: { type: "object", properties: { vehicleId: { type: "string", description: "Railcar or container number exactly as shown (e.g. TBOX636255, SMW608012)" }, currentLocation: { type: "string", description: "Current location city/state as shown" }, estimatedArrival: { type: "string", description: "ETA date in YYYY-MM-DD format" }, shipmentStatus: { type: "string", enum: ["programado", "en_transito", "en_aduana", "entregado"], description: "en_transito for Train Arrived/Departed, en_aduana for customs hold, entregado for delivered" } }, required: ["vehicleId"] } } }, required: ["updates"] } } },
  { type: "function", function: { name: "update_market_price", description: "Update or set a market reference price from TTO or RISI for a grade and region. Use current month if month not specified.", parameters: { type: "object", properties: { source: { type: "string", enum: ["TTO", "RISI"], description: "Price source" }, grade: { type: "string", description: "Pulp grade e.g. NBSK, SBSK, BHK" }, region: { type: "string", description: "Region e.g. North America, Europe, China" }, price: { type: "number", description: "Price in USD/ADMT" }, priceType: { type: "string", enum: ["list", "net", "derived"], description: "Price type, default net" }, changeValue: { type: "number", description: "Change from previous month (positive or negative)" }, month: { type: "string", description: "Month in YYYY-MM format, defaults to current month" } }, required: ["source", "grade", "region", "price"] } } },
  { type: "function", function: { name: "schedule_report", description: "Schedule a report to be sent to a client", parameters: { type: "object", properties: { clientName: { type: "string" }, templateName: { type: "string" }, sendDate: { type: "string" }, notes: { type: "string" } }, required: ["clientName", "sendDate"] } } },
  { type: "function", function: { name: "generate_report", description: "Generate a PDF or Excel report for a client. Returns a download link. Use when user asks for a report, export, or document.", parameters: { type: "object", properties: { clientName: { type: "string", description: "Client name (fuzzy match)" }, format: { type: "string", enum: ["pdf", "excel"], description: "Report format" }, filter: { type: "string", enum: ["active", "all"], description: "active = only active shipments, all = include delivered" }, columns: { type: "string", description: "Comma-separated column keys. Options: currentLocation,poNumber,invoiceNumber,vehicleId,blNumber,quantityTons,sellPrice,shipmentStatus,shipmentDate,item,terms,transportType,customerPaymentStatus,estimatedArrival,salesDocument,billingDocument,clientPoNumber. Leave empty for defaults." } }, required: ["clientName", "format"] } } },
  { type: "function", function: { name: "run_calculation", description: "Run a SQL query on the database for exact calculations. Use this for any math: sums, totals, averages, counts, filtering. Tables: invoices (invoice_number, purchase_order_id, quantity_tons, sell_price_override, buy_price_override, shipment_date, due_date, customer_payment_status, supplier_payment_status, shipment_status, item, vehicle_id, current_location), purchase_orders (po_number, po_date, client_id, supplier_id, sell_price, buy_price, product, terms, transport_type, status), clients (id, name), suppliers (id, name), supplier_payments (supplier_id, purchase_order_id, amount_usd, payment_date, estimated_tons, notes), market_prices (source, grade, region, month, price, price_type, change_value, unit). Revenue = quantity_tons * COALESCE(sell_price_override, sell_price). Cost = quantity_tons * COALESCE(buy_price_override, buy_price).", parameters: { type: "object", properties: { sql_query: { type: "string", description: "SELECT SQL query to run. Only SELECT allowed, no INSERT/UPDATE/DELETE." } }, required: ["sql_query"] } } },
];

// Alias map for fuzzy client/supplier matching
const ALIASES: Record<string, string[]> = {
  "Kimberly-Clark de México, S.A.B. De C.V.": ["kimberly", "kcm", "kc", "kim", "kimberly clark", "kc mexico", "kcm mexico", "kimberly-clark"],
  "Biopappel Scribe, S.A. de C.V.": ["biopappel", "scribe", "biopapel", "bio"],
  "Copamex Industrias, S.A. De C.V.": ["copamex", "copa"],
  "Grupo Corporativo Papelera, S.A. DE C.V.": ["grupo corporativo", "gcp", "corporativo", "gcptissue"],
  "Papelera de Chihuahua, S.A. De C.V.": ["pch", "chihuahua", "papelera chihuahua", "papelera de chihuahua"],
  "Sanitate S. De R.L. De C.V.": ["sanitate", "sani"],
  "Arauco": ["arauco"],
  "Cascade Pacific Pulp (CPP)": ["cascade", "cpp", "cascade pacific", "pacific pulp"],
  "APP China Trading Limited": ["app", "app china", "app of china", "app trading"],
};

async function findClient(input: string) {
  // First try exact LIKE match
  const direct = await db.query.clients.findFirst({ where: like(clients.name, `%${input}%`) });
  if (direct) return direct;
  // Try alias match
  const lower = input.toLowerCase().trim();
  for (const [fullName, aliases] of Object.entries(ALIASES)) {
    if (aliases.some(a => lower === a || lower.includes(a) || a.includes(lower))) {
      return db.query.clients.findFirst({ where: like(clients.name, `%${fullName.substring(0, 10)}%`) });
    }
  }
  return null;
}

async function findSupplier(input: string) {
  const direct = await db.query.suppliers.findFirst({ where: like(suppliers.name, `%${input}%`) });
  if (direct) return direct;
  const lower = input.toLowerCase().trim();
  for (const [fullName, aliases] of Object.entries(ALIASES)) {
    if (aliases.some(a => lower === a || lower.includes(a) || a.includes(lower))) {
      return db.query.suppliers.findFirst({ where: like(suppliers.name, `%${fullName.substring(0, 10)}%`) });
    }
  }
  return null;
}

async function exec(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === "query_data") {
      const qt = args.query_type as string;
      if (qt === "summary") {
        const data = await db.select({ clientName: clients.name, invoiceCount: count(invoices.id), totalTons: sql<number>`coalesce(sum(${invoices.quantityTons}), 0)`, totalRevenue: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.sellPriceOverride}, ${purchaseOrders.sellPrice})), 0)`, totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)` }).from(invoices).leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id)).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).groupBy(clients.name);
        return JSON.stringify(data);
      }
      if (qt === "unpaid_invoices") {
        const data = await db.select({ invoiceNumber: invoices.invoiceNumber, poNumber: purchaseOrders.poNumber, clientName: clients.name, tons: invoices.quantityTons, sellPrice: purchaseOrders.sellPrice }).from(invoices).leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id)).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).where(eq(invoices.customerPaymentStatus, "unpaid"));
        return JSON.stringify(data);
      }
      if (qt === "active_pos") {
        const data = await db.select({ poNumber: purchaseOrders.poNumber, clientName: clients.name, supplierName: suppliers.name, sellPrice: purchaseOrders.sellPrice, buyPrice: purchaseOrders.buyPrice, product: purchaseOrders.product, licenseFsc: purchaseOrders.licenseFsc, chainOfCustody: purchaseOrders.chainOfCustody, inputClaim: purchaseOrders.inputClaim, outputClaim: purchaseOrders.outputClaim }).from(purchaseOrders).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id)).where(eq(purchaseOrders.status, "active"));
        return JSON.stringify(data);
      }
      if (qt === "all_pos") {
        const data = await db.select({ poNumber: purchaseOrders.poNumber, poDate: purchaseOrders.poDate, clientName: clients.name, supplierName: suppliers.name, product: purchaseOrders.product, status: purchaseOrders.status, sellPrice: purchaseOrders.sellPrice, buyPrice: purchaseOrders.buyPrice, licenseFsc: purchaseOrders.licenseFsc, chainOfCustody: purchaseOrders.chainOfCustody, inputClaim: purchaseOrders.inputClaim, outputClaim: purchaseOrders.outputClaim }).from(purchaseOrders).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id)).orderBy(purchaseOrders.poNumber);
        return JSON.stringify(args.filter_name ? data.filter(p => p.clientName?.toLowerCase().includes((args.filter_name as string).toLowerCase())) : data);
      }
      if (qt === "client_list") return JSON.stringify(await db.select({ id: clients.id, name: clients.name, email: clients.contactEmail }).from(clients));
      if (qt === "supplier_list") return JSON.stringify(await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers));
      if (qt === "supplier_payments") {
        const filter = args.filter_name as string | undefined;
        let data = await db.select({ id: supplierPayments.id, supplierName: suppliers.name, amount: supplierPayments.amountUsd, date: supplierPayments.paymentDate, tons: supplierPayments.estimatedTons, notes: supplierPayments.notes, poNumber: purchaseOrders.poNumber }).from(supplierPayments).leftJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id)).leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id)).orderBy(desc(supplierPayments.paymentDate));
        if (filter) data = data.filter(d => d.supplierName?.toLowerCase().includes(filter.toLowerCase()));
        return JSON.stringify(data.slice(0, 30));
      }
      if (qt === "active_shipments") {
        const data = await db.select({ invoiceNumber: invoices.invoiceNumber, poNumber: purchaseOrders.poNumber, clientName: clients.name, tons: invoices.quantityTons, status: invoices.shipmentStatus, location: invoices.currentLocation, vehicleId: invoices.vehicleId, blNumber: invoices.blNumber, eta: invoices.estimatedArrival, shipDate: invoices.shipmentDate }).from(invoices).leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id)).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).where(sql`${invoices.shipmentStatus} != 'entregado'`);
        return JSON.stringify(data);
      }
      if (qt === "templates") return JSON.stringify(await db.select({ id: reportTemplates.id, name: reportTemplates.name, format: reportTemplates.format }).from(reportTemplates));
      if (qt === "scheduled_reports") {
        const data = await db.select({ id: scheduledReports.id, clientName: clients.name, templateName: reportTemplates.name, sendDate: scheduledReports.sendDate, status: scheduledReports.status }).from(scheduledReports).leftJoin(clients, eq(scheduledReports.clientId, clients.id)).leftJoin(reportTemplates, eq(scheduledReports.templateId, reportTemplates.id)).where(eq(scheduledReports.status, "pending"));
        return JSON.stringify(data);
      }
      return "Unknown query type";
    }

    if (name === "create_po") {
      const cl = await findClient(args.clientName as string);
      const su = await findSupplier(args.supplierName as string);
      if (!cl) return `Client "${args.clientName}" not found. Available clients: ${(await db.select({ name: clients.name }).from(clients)).map(c => c.name).join(", ")}`;
      if (!su) return `Supplier "${args.supplierName}" not found. Available suppliers: ${(await db.select({ name: suppliers.name }).from(suppliers)).map(s => s.name).join(", ")}`;
      const sell = args.sellPrice as number;
      const buy = args.buyPrice as number;
      // Auto-fill FSC from supplier if not provided
      const licenseFsc = (args.licenseFsc as string) || su.fscLicense || null;
      const chainOfCustody = (args.chainOfCustody as string) || su.fscChainOfCustody || null;
      const inputClaim = (args.inputClaim as string) || su.fscInputClaim || null;
      const outputClaim = (args.outputClaim as string) || cl.fscOutputClaim || null;
      await db.insert(purchaseOrders).values({ poNumber: args.poNumber as string, poDate: (args.poDate as string) || null, clientId: cl.id, supplierId: su.id, sellPrice: sell, buyPrice: buy, product: args.product as string, terms: (args.terms as string) || null, transportType: (args.transportType as "ffcc"|"ship"|"truck") || null, licenseFsc, chainOfCustody, inputClaim, outputClaim });
      const fscInfo = [inputClaim && `Input: ${inputClaim}`, outputClaim && `Output: ${outputClaim}`].filter(Boolean).join(", ");
      return `PO ${args.poNumber} created successfully.
- Client: ${cl.name}
- Supplier: ${su.name}
- Product: ${args.product}
- Sell: $${sell}/TN | Buy: $${buy}/TN | Margin: $${(sell - buy).toFixed(2)}/TN
- Terms: ${args.terms || "-"} | Transport: ${args.transportType || "-"}
- FSC License: ${licenseFsc || "-"} | Chain of Custody: ${chainOfCustody || "-"}
- FSC Claims: ${fscInfo || "-"}`;
    }

    if (name === "create_invoice") {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.poNumber, args.poNumber as string) });
      if (!po) return `PO "${args.poNumber}" not found.`;
      await db.insert(invoices).values({ invoiceNumber: args.invoiceNumber as string, purchaseOrderId: po.id, quantityTons: args.quantityTons as number, item: (args.item as string) || null, shipmentDate: (args.shipmentDate as string) || null, vehicleId: (args.vehicleId as string) || null, blNumber: (args.blNumber as string) || null, currentLocation: (args.currentLocation as string) || null, destination: (args.destination as string) || null, balesCount: (args.balesCount as number) || null, unitsPerBale: (args.unitsPerBale as number) || null, invoiceDate: (args.invoiceDate as string) || null, salesDocument: (args.salesDocument as string) || null, billingDocument: (args.billingDocument as string) || null });
      const tons = args.quantityTons as number;
      const totalSell = po.sellPrice ? tons * po.sellPrice : null;
      const totalBuy = po.buyPrice ? tons * po.buyPrice : null;
      return `Invoice ${args.invoiceNumber} created on PO ${args.poNumber}:
- Tons: ${tons} TN
- Total Revenue: ${totalSell ? `$${totalSell.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"} (${tons} × $${po.sellPrice}/TN)
- Total Cost: ${totalBuy ? `$${totalBuy.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"} (${tons} × $${po.buyPrice}/TN)
- Location: ${(args.currentLocation as string) || "-"}`;
    }

    if (name === "update_invoice") {
      let inv = null;
      const invoiceNum = args.invoiceNumber as string | undefined;
      const vehicleLookup = args.vehicleIdLookup as string | undefined;
      const blLookup = args.blNumberLookup as string | undefined;
      const salesDocLookup = args.salesDocumentLookup as string | undefined;

      // Helper: normalize string for fuzzy matching (remove spaces, uppercase)
      const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();

      // Try all lookup methods in order
      if (invoiceNum) inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNum) });
      // Vehicle ID lookup: exact first, then normalize spaces
      if (!inv && vehicleLookup) {
        inv = await db.query.invoices.findFirst({ where: eq(invoices.vehicleId, vehicleLookup) });
        if (!inv) {
          // Try with/without spaces using LIKE
          const noSpace = vehicleLookup.replace(/\s+/g, "");
          inv = await db.query.invoices.findFirst({ where: sql`REPLACE(${invoices.vehicleId}, ' ', '') = ${noSpace}` });
        }
      }
      if (!inv && blLookup) inv = await db.query.invoices.findFirst({ where: eq(invoices.blNumber, blLookup) });
      if (!inv && salesDocLookup) inv = await db.query.invoices.findFirst({ where: eq(invoices.salesDocument, salesDocLookup) });
      // If invoiceNumber doesn't start with IX, try it as a vehicleId (with space normalization)
      if (!inv && invoiceNum && !invoiceNum.toUpperCase().startsWith("IX")) {
        inv = await db.query.invoices.findFirst({ where: eq(invoices.vehicleId, invoiceNum) });
        if (!inv) {
          const noSpace = invoiceNum.replace(/\s+/g, "");
          inv = await db.query.invoices.findFirst({ where: sql`REPLACE(${invoices.vehicleId}, ' ', '') = ${noSpace}` });
        }
      }
      void norm; // used for reference

      if (!inv) {
        const tried = [invoiceNum, vehicleLookup, blLookup, salesDocLookup].filter(Boolean).join(", ");
        const available = await db.select({ n: invoices.invoiceNumber, v: invoices.vehicleId, b: invoices.blNumber }).from(invoices).where(sql`${invoices.shipmentStatus} != 'entregado'`).limit(40);
        const list = available.map(r => `invoiceNumber="${r.n}" | vehicleIdLookup="${r.v || ""}"`).join("\n");
        return `Invoice not found. Tried: "${tried}"\n\nIMPORTANT: To update by railcar number, use the vehicleIdLookup field (NOT invoiceNumber).\n\nActive invoices with their vehicle IDs:\n${list}\n\nCall update_invoice again using vehicleIdLookup with the exact vehicle ID shown above.`;
      }

      const ud: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      const skipKeys = new Set(["invoiceNumber", "vehicleIdLookup", "blNumberLookup", "salesDocumentLookup"]);
      for (const [k, v] of Object.entries(args)) { if (!skipKeys.has(k) && v !== undefined && v !== null && v !== "") ud[k] = v; }
      if (args.currentLocation) { ud.lastLocationUpdate = new Date().toISOString(); }
      if (args.shipmentStatus && args.shipmentStatus !== inv.shipmentStatus) {
        await db.insert(shipmentUpdates).values({ invoiceId: inv.id, previousStatus: inv.shipmentStatus, newStatus: args.shipmentStatus as string });
      }
      await db.update(invoices).set(ud).where(eq(invoices.id, inv.id));
      return `✓ ${inv.invoiceNumber} (railcar: ${inv.vehicleId || "-"}) updated: ${Object.entries(args).filter(([k]) => !skipKeys.has(k)).map(([k, v]) => `${k}=${v}`).join(", ")}`;
    }

    if (name === "update_po") {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.poNumber, args.poNumber as string) });
      if (!po) return `PO "${args.poNumber}" not found.`;
      const ud: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) { if (k !== "poNumber" && v) ud[k] = v; }
      await db.update(purchaseOrders).set(ud).where(eq(purchaseOrders.id, po.id));
      return `PO ${args.poNumber} updated: ${Object.entries(args).filter(([k]) => k !== "poNumber").map(([k, v]) => `${k}=${v}`).join(", ")}`;
    }

    if (name === "create_supplier_payment") {
      const su = await findSupplier(args.supplierName as string);
      if (!su) return `Supplier "${args.supplierName}" not found.`;
      let poId: number | undefined;
      if (args.poNumber) {
        const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.poNumber, args.poNumber as string) });
        if (po) poId = po.id;
      }
      await db.insert(supplierPayments).values({ supplierId: su.id, purchaseOrderId: poId, amountUsd: args.amountUsd as number, paymentDate: args.paymentDate as string, estimatedTons: (args.estimatedTons as number) || null, pricePerTon: (args.pricePerTon as number) || null, reference: (args.reference as string) || null, notes: (args.notes as string) || null });
      return `Payment recorded: $${(args.amountUsd as number).toLocaleString()} to ${su.name} on ${args.paymentDate}${args.estimatedTons ? ` (${args.estimatedTons} TN est.)` : ""}`;
    }

    if (name === "create_client") {
      const existing = await findClient(args.name as string);
      if (existing) return `Client "${args.name}" already exists as "${existing.name}" (id: ${existing.id})`;

      await db.insert(clients).values({ name: args.name as string, contactName: (args.contactName as string) || null, contactEmail: (args.contactEmail as string) || null, phone: (args.phone as string) || null, accessToken: uuidv4(), portalEnabled: true });
      return `Client "${args.name}" created with portal enabled`;
    }

    if (name === "update_client") {
      const cl = await findClient(args.clientName as string);
      if (!cl) return `Client "${args.clientName}" not found.`;
      const ud: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (args.fscLicense) ud.fscLicense = args.fscLicense;
      if (args.fscChainOfCustody) ud.fscChainOfCustody = args.fscChainOfCustody;
      if (args.fscInputClaim) ud.fscInputClaim = args.fscInputClaim;
      if (args.fscOutputClaim) ud.fscOutputClaim = args.fscOutputClaim;
      if (args.contactName) ud.contactName = args.contactName;
      if (args.contactEmail) ud.contactEmail = args.contactEmail;
      if (args.phone) ud.phone = args.phone;
      if (args.paymentTermsDays) ud.paymentTermsDays = args.paymentTermsDays;
      await db.update(clients).set(ud).where(eq(clients.id, cl.id));
      return `Client "${cl.name}" updated: ${Object.entries(ud).filter(([k]) => k !== "updatedAt").map(([k,v]) => `${k}=${v}`).join(", ")}`;
    }

    if (name === "create_supplier") {
      const existing = await findSupplier(args.name as string);
      if (existing) return `Supplier "${args.name}" already exists as "${existing.name}"`;
      await db.insert(suppliers).values({ name: args.name as string, contactName: (args.contactName as string) || null, contactEmail: (args.contactEmail as string) || null, phone: (args.phone as string) || null });
      return `Supplier "${args.name}" created`;
    }

    if (name === "update_supplier") {
      const su = await findSupplier(args.supplierName as string);
      if (!su) return `Supplier "${args.supplierName}" not found.`;
      const ud: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (args.fscLicense) ud.fscLicense = args.fscLicense;
      if (args.fscChainOfCustody) ud.fscChainOfCustody = args.fscChainOfCustody;
      if (args.fscInputClaim) ud.fscInputClaim = args.fscInputClaim;
      if (args.fscOutputClaim) ud.fscOutputClaim = args.fscOutputClaim;
      if (args.contactName) ud.contactName = args.contactName;
      if (args.contactEmail) ud.contactEmail = args.contactEmail;
      if (args.phone) ud.phone = args.phone;
      await db.update(suppliers).set(ud).where(eq(suppliers.id, su.id));
      return `Supplier "${su.name}" updated: ${Object.entries(ud).filter(([k]) => k !== "updatedAt").map(([k,v]) => `${k}=${v}`).join(", ")}`;
    }

    if (name === "delete_record") {
      const t = args.type as string;
      const id = args.identifier as string;
      if (t === "invoice") {
        const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, id) });
        if (!inv) return `Invoice "${id}" not found.`;
        await db.delete(shipmentUpdates).where(eq(shipmentUpdates.invoiceId, inv.id));
        await db.delete(invoices).where(eq(invoices.id, inv.id));
        return `Invoice ${id} deleted`;
      }
      if (t === "po") {
        const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.poNumber, id) });
        if (!po) return `PO "${id}" not found.`;
        const invs = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.purchaseOrderId, po.id));
        for (const inv of invs) { await db.delete(shipmentUpdates).where(eq(shipmentUpdates.invoiceId, inv.id)); }
        await db.delete(invoices).where(eq(invoices.purchaseOrderId, po.id));
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, po.id));
        return `PO ${id} and its ${invs.length} invoices deleted`;
      }
      if (t === "payment") {
        await db.delete(supplierPayments).where(eq(supplierPayments.id, Number(id)));
        return `Payment ${id} deleted`;
      }
      return `Delete type "${t}" not supported. Use: po, invoice, or payment`;
    }

    if (name === "update_market_price") {
      const now = new Date();
      const targetMonth = (args.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await db.delete(marketPrices).where(
        and(
          eq(marketPrices.source, args.source as string),
          eq(marketPrices.grade, args.grade as string),
          eq(marketPrices.region, args.region as string),
          eq(marketPrices.month, targetMonth),
        )
      );
      await db.insert(marketPrices).values({
        source: args.source as string,
        grade: args.grade as string,
        region: args.region as string,
        month: targetMonth,
        price: args.price as number,
        priceType: (args.priceType as string) || "net",
        changeValue: args.changeValue != null ? args.changeValue as number : null,
      });
      const changeStr = args.changeValue != null ? ` (${(args.changeValue as number) > 0 ? "+" : ""}${args.changeValue})` : "";
      return `Market price updated: ${args.source} ${args.grade} ${args.region} for ${targetMonth} = $${args.price}/ADMT${changeStr}`;
    }

    if (name === "schedule_report") {
      const cl = await findClient(args.clientName as string);
      if (!cl) return `Client "${args.clientName}" not found.`;
      let tmplId = 1; // default template
      if (args.templateName) {
        const tmpl = await db.query.reportTemplates.findFirst({ where: like(reportTemplates.name, `%${args.templateName}%`) });
        if (tmpl) tmplId = tmpl.id;
      }
      await db.insert(scheduledReports).values({ clientId: cl.id, templateId: tmplId, sendDate: args.sendDate as string, notes: (args.notes as string) || null });
      return `Report scheduled for ${cl.name} on ${args.sendDate}`;
    }

    if (name === "generate_report") {
      const cl = await findClient(args.clientName as string);
      if (!cl) return `Client "${args.clientName}" not found. Available: ${(await db.select({ name: clients.name }).from(clients)).map(c => c.name).join(", ")}`;
      const format = args.format as string;
      const filter = (args.filter as string) || "active";
      const columns = (args.columns as string) || "";
      const defaultCols = "currentLocation,poNumber,clientPoNumber,invoiceNumber,vehicleId,blNumber,quantityTons,sellPrice,shipmentStatus,shipmentDate";
      const colStr = columns || defaultCols;
      if (format === "pdf") {
        const url = `/api/pdf-report?clientId=${cl.id}&filter=${filter}&columns=${colStr}`;
        return `PDF report ready for ${cl.name}.\n\n[Download PDF](${url})`;
      } else {
        const url = `/api/export?clientId=${cl.id}&filter=${filter}&columns=${colStr}`;
        return `Excel report ready for ${cl.name}.\n\n[Download Excel](${url})`;
      }
    }

    if (name === "update_shipment_tracking") {
      const updates = args.updates as Array<{ vehicleId: string; currentLocation?: string; estimatedArrival?: string; shipmentStatus?: string }>;
      const now = new Date().toISOString();
      const results: string[] = [];
      for (const u of updates) {
        const vid = u.vehicleId.replace(/\s+/g, ""); // normalize spaces
        // Find by vehicleId (exact or space-normalized)
        const found = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, vehicleId: invoices.vehicleId, shipmentStatus: invoices.shipmentStatus })
          .from(invoices)
          .where(sql`REPLACE(${invoices.vehicleId}, ' ', '') = ${vid}`)
          .limit(1);
        if (found.length === 0) {
          results.push(`❌ ${u.vehicleId} — not found in active shipments`);
          continue;
        }
        const inv = found[0];
        const ud: Record<string, unknown> = { updatedAt: now, lastLocationUpdate: now };
        if (u.currentLocation) ud.currentLocation = u.currentLocation;
        if (u.estimatedArrival) ud.estimatedArrival = u.estimatedArrival;
        if (u.shipmentStatus) ud.shipmentStatus = u.shipmentStatus;
        if (u.shipmentStatus && u.shipmentStatus !== inv.shipmentStatus) {
          await db.insert(shipmentUpdates).values({ invoiceId: inv.id, previousStatus: inv.shipmentStatus, newStatus: u.shipmentStatus });
        }
        await db.update(invoices).set(ud).where(eq(invoices.id, inv.id));
        results.push(`✅ ${inv.invoiceNumber} (${inv.vehicleId}) → ${u.currentLocation || "-"} | ETA: ${u.estimatedArrival || "-"} | Status: ${u.shipmentStatus || "unchanged"}`);
      }
      return results.join("\n");
    }

    if (name === "run_calculation") {
      let query = (args.sql_query as string).trim();
      if (!query.toUpperCase().startsWith("SELECT")) return "Error: Only SELECT queries allowed.";

      // Resolve client/supplier aliases in the SQL query
      // Replace any alias with the real DB name so LIKE filters work
      const SQL_ALIASES: Record<string, string> = {
        "kcm": "Kimberly-Clark", "kc": "Kimberly-Clark", "kimberly": "Kimberly-Clark",
        "kim": "Kimberly-Clark", "kimberly clark": "Kimberly-Clark",
        "biopappel": "Biopappel", "scribe": "Biopappel Scribe", "bio": "Biopappel",
        "copamex": "Copamex", "copa": "Copamex",
        "gcp": "Grupo Corporativo", "grupo corporativo": "Grupo Corporativo",
        "pch": "Papelera de Chihuahua", "chihuahua": "Papelera de Chihuahua",
        "sanitate": "Sanitate", "sani": "Sanitate",
        "cascade": "Cascade Pacific", "cpp": "Cascade Pacific",
        "arauco": "Arauco",
        "app china": "APP China", "app": "APP China",
      };
      // Replace LIKE '%alias%' patterns with real name
      for (const [alias, realName] of Object.entries(SQL_ALIASES)) {
        const aliasPattern = new RegExp(`LIKE\\s+'%${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}%'`, "gi");
        if (aliasPattern.test(query)) {
          query = query.replace(aliasPattern, `LIKE '%${realName}%'`);
        }
        // Also replace = 'alias' patterns
        const eqPattern = new RegExp(`=\\s+'${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, "gi");
        if (eqPattern.test(query)) {
          query = query.replace(eqPattern, `LIKE '%${realName}%'`);
        }
      }

      try {
        const rawDb = createClient({
          url: process.env.TURSO_DATABASE_URL || "file:sqlite.db",
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        const result = await rawDb.execute(query);
        return JSON.stringify(result.rows);
      } catch (sqlErr: unknown) {
        return `SQL Error: ${sqlErr instanceof Error ? sqlErr.message : "unknown"}. Query was: ${query}`;
      }
    }

    return "Unknown tool";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI tool error] ${name}:`, msg, args);
    return `Tool error in ${name}: ${msg}. Args used: ${JSON.stringify(args)}`;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured.\n\n1. Go to https://platform.openai.com/api-keys\n2. Add $5 credit\n3. In .env.local add: OPENAI_API_KEY=sk-your-key" }, { status: 400 });
  }

  const { messages: rawMessages } = await req.json();

  // Convert messages with imageUrl/imageUrls to OpenAI vision format
  const messages = rawMessages.map((m: { role: string; content: string; imageUrl?: string; imageUrls?: string[] }) => {
    const imgUrls: string[] = m.imageUrls?.length ? m.imageUrls : m.imageUrl ? [m.imageUrl] : [];
    if (imgUrls.length > 0 && m.role === "user") {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...imgUrls.map(url => ({ type: "image_url", image_url: { url, detail: "high" } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  try {
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `You are the AI assistant for BZA International Services (cellulose/pulp trading, McAllen TX). IMPORTANT: Always respond in English. Never switch to Spanish or any other language, regardless of how the user writes their message.

## FILE PROCESSING — INVOICE & BILLING DOCUMENTS

### SUPPLIER DOCUMENTS (BOL, PACKING LIST, SHIPPING ADVICE)
When the user uploads a supplier document, extract ALL available fields and call create_invoice (or update_invoice if it already exists):

| Document field | System field |
|---|---|
| Railcar / container / truck # | vehicleId |
| BOL # / Bill of Lading # | blNumber |
| Bales count | balesCount |
| Units per bale | unitsPerBale |
| Net weight / ADMT / metric tons | quantityTons |
| Ship date / dispatch date | shipmentDate |
| Destination / consignee city | destination |
| Client PO # / purchase order # | salesDocument |
| Invoice # / reference # | invoiceNumber |
| Origin / loading location | currentLocation |
| ETA / estimated arrival | estimatedArrival |
| BZA PO # (e.g. X0043) | poNumber (required for create_invoice) |

- If multiple railcars/containers in one document → create one invoice per vehicle.
- If the BZA PO number is not in the document, ask the user before creating.
- Always confirm every field extracted and every record created/updated.

### CLIENT BILLING DOCUMENTS (FACTURAS, SAP BILLING DOCS)
When the user uploads a client invoice, billing document, or SAP output (factura):

| Document field | System field |
|---|---|
| Billing document # / factura # | billingDocument |
| Client PO # / pedido # | salesDocument |
| Delivery date / fecha entrega | shipmentDate or invoiceDate |
| Net tons / toneladas netas | quantityTons |
| Net price / precio neto | sellPriceOverride |
| Total amount | (confirm with quantityTons × sellPriceOverride) |
| Vehicle # / railcar # | vehicleId (use to find existing invoice) |
| BL # | blNumber |

- For billing docs: try to find existing invoice by vehicleId or salesDocument, then update with billingDocument number and invoiceDate.
- If creating new: ask for BZA PO number first.
- If you find the invoice by vehicle or PO, update it — don't create a duplicate.

### GENERAL RULES FOR ALL DOCUMENTS
- When the user uploads an image, you can SEE it via GPT-4o vision — read all text, tables, and numbers.
- Always show the user a summary table of what you extracted BEFORE calling any tools.
- Ask for confirmation if any required field is missing or ambiguous.
- When the user uploads a tracking screenshot, report, or email with railcar/container locations and ETAs:
  1. Read ALL vehicle IDs and their data from the image/document
  2. Call update_shipment_tracking ONCE with ALL vehicles in the updates array
  3. Map status (IMPORTANT — read carefully):
     - "Train Arrived" → en_transito
     - "Train Departed" → en_transito
     - "Released" → en_transito
     - "Hold" → en_aduana
     - "Actual Placed" → en_transito
     - ONLY use "entregado" if the user explicitly says the shipment was received/delivered at destination
     - "Interchanged Delivered [date]" = ETA DATE, NOT delivered status — use as estimatedArrival, keep status as en_transito
  4. ETA: "Interchanged Delivered [date]" and "Actual Placed [date]" are ETAs → use as estimatedArrival in YYYY-MM-DD format
  5. Report every ✅ success and ❌ not found to the user

## ABSOLUTE RULES
1. For ANY number, total, sum, count, or data question — you MUST use run_calculation with a SQL query. NEVER calculate yourself.
2. Report the EXACT number from the SQL result. Do not round or modify it.
3. When the SQL returns a number, present it formatted with commas and 2 decimal places.

## DATABASE (SQLite)
Tables and columns:
- invoices: id, invoice_number, purchase_order_id, quantity_tons, sell_price_override (nullable), buy_price_override (nullable), shipment_date, estimated_arrival, due_date, shipment_status, customer_payment_status ('paid'/'unpaid'), supplier_payment_status, item, vehicle_id, current_location, last_location_update, bl_number, sales_document, billing_document, invoice_date, payment_terms_days
- purchase_orders: id, po_number, po_date, client_id, client_po_number, supplier_id, sell_price, buy_price, product, terms, transport_type, status ('active'/'completed'/'cancelled'), license_fsc, chain_of_custody, input_claim, output_claim
- clients: id, name, contact_name, contact_email, phone, access_token, portal_enabled
- suppliers: id, name, contact_name, contact_email, phone
- supplier_payments: id, supplier_id, purchase_order_id, invoice_id, amount_usd, payment_date, estimated_tons, price_per_ton, actual_tons, actual_amount, adjustment_amount, adjustment_status, notes, reference
- shipment_updates: id, invoice_id, previous_status, new_status, comment
- report_templates: id, name, description, format, columns, subject, message, is_system
- scheduled_reports: id, client_id, template_id, send_date, reminder_email, status, sent_at, notes

## CLIENT/SUPPLIER ALIASES & EXACT DB NAMES
When the user mentions a client/supplier by abbreviation, resolve it to the exact DB name below.
ALWAYS use LIKE '%name%' (never =) when filtering by client/supplier name in SQL.

Clients (exact DB names):
- "Kimberly-Clark de México, S.A.B. De C.V." → aliases: kimberly, kcm, kc, kim, kimberly clark
- "Biopappel Scribe, S.A. de C.V." → aliases: biopappel, scribe, bio, biopapel
- "Copamex Industrias, S.A. De C.V." → aliases: copamex, copa
- "Grupo Corporativo Papelera, S.A. DE C.V." → aliases: gcp, grupo corporativo, gcptissue
- "Papelera de Chihuahua, S.A. De C.V." → aliases: pch, chihuahua, papelera chihuahua
- "Sanitate S. De R.L. De C.V." → aliases: sanitate, sani

Suppliers (exact DB names):
- "Cascade Pacific Pulp, LLC" → aliases: cascade, cpp, cascade pacific
- "Celulosa Arauco y Constitucion S.A." → aliases: arauco
- "APP China Trading Limited" → aliases: app, app china

When writing SQL for a specific client like "KCM" or "Kimberly Clark", always use:
WHERE c.name LIKE '%Kimberly-Clark%'
The system also auto-resolves aliases server-side, so you can pass the user's term and it will be resolved.

## CREATING RECORDS
- Before create_po: the system automatically reads FSC data from the supplier (fscLicense, fscChainOfCustody, fscInputClaim) and client (fscOutputClaim). You do NOT need to query previous POs for FSC — it comes from the client/supplier record directly.
- If the user says "FSC" or "PEFC" without specifying details, the FSC will be auto-filled from the supplier and client records.
- To set FSC info on a client or supplier, use update_client or update_supplier with the fsc fields.
- If create_po fails with "not found", immediately retry using the exact name from the available list returned in the error.
- Never tell the user to contact "technical support" — always show the EXACT error message returned by the tool.
- If a tool returns "Tool error in create_po: UNIQUE constraint failed", it means the PO number already exists — tell the user and ask for a different number.
- If a tool returns "not found", show the available options from the error and retry with the correct name.

## KEY SQL PATTERNS (copy these exactly, modify WHERE as needed)

Revenue for an invoice: i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)
Cost for an invoice: i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)
Base JOIN: FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
With client: JOIN clients c ON po.client_id = c.id
With supplier: JOIN suppliers s ON po.supplier_id = s.id

Total AR (all unpaid):
SELECT ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)), 2) as total_ar FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id WHERE i.customer_payment_status = 'unpaid'

AR excluding specific invoices (add NOT IN):
SELECT ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)), 2) as total_ar FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id WHERE i.customer_payment_status = 'unpaid' AND i.invoice_number NOT IN ('IX0042-6','IX0042-7','IX0042-8','IX0042-9')

Revenue by year:
SELECT SUBSTR(i.shipment_date,1,4) as year, ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)), 2) as revenue, ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)), 2) as cost FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id GROUP BY year ORDER BY year

Revenue by client:
SELECT c.name, ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)), 2) as revenue FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id JOIN clients c ON po.client_id = c.id GROUP BY c.name ORDER BY revenue DESC

List unpaid invoices:
SELECT i.invoice_number, po.po_number, c.name, i.quantity_tons, ROUND(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price), 2) as amount, i.due_date FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id JOIN clients c ON po.client_id = c.id WHERE i.customer_payment_status = 'unpaid' ORDER BY i.due_date

Supplier balance:
SELECT s.name, ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)), 2) as total_cost FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id JOIN suppliers s ON po.supplier_id = s.id GROUP BY s.name

Supplier payments total:
SELECT s.name, ROUND(SUM(sp.amount_usd), 2) as total_paid FROM supplier_payments sp JOIN suppliers s ON sp.supplier_id = s.id GROUP BY s.name

Update tons: Use update_invoice with the invoice_number and new quantityTons value.

## MARKET PRICES TABLE
- market_prices: id, source (TTO/RISI), grade (NBSK/SBSK/BHK), region, month (YYYY-MM), price, price_type (list/net), change_value, unit (USD/ADMT)
- TTO publishes net prices monthly for NA pulp grades
- RISI (Fastmarkets) publishes list and net prices
- Use this data to help with pricing proposals and market analysis

## BUSINESS ANALYSIS & PROPOSALS
When Eduardo asks for help with proposals or pricing strategy:
1. First query current market prices: SELECT * FROM market_prices WHERE month = (SELECT MAX(month) FROM market_prices) ORDER BY source, grade
2. Query historical prices to understand trends: SELECT source, grade, month, price, change_value FROM market_prices WHERE grade = 'NBSK' ORDER BY month DESC
3. Query what we currently sell/buy at: SELECT c.name, po.product, po.sell_price, po.buy_price, po.sell_price - po.buy_price as margin FROM purchase_orders po JOIN clients c ON po.client_id = c.id WHERE po.status = 'active'
4. Calculate volumes by client/product to understand leverage
5. Provide a recommendation with:
   - Current market price vs our sell/buy price
   - Margin analysis (current margin, market-based margin)
   - Volume-based discount suggestions
   - Competitive positioning based on TTO vs RISI indices
   - Risk assessment (price trending up/down?)

Example analysis: "KC is buying NBSK at $X. TTO net is $Y. Market is trending [up/down] based on last 3 months. Recommend selling at $Z for a margin of $W/ton."

## CAPABILITIES
You can: query/calculate data, create POs/invoices/clients/suppliers, record supplier payments, update any field on invoices or POs, delete records, schedule reports, generate PDF/Excel reports, analyze market prices, build pricing proposals.

When user asks for a report or export, use generate_report immediately. CRITICAL: Copy the markdown download link from the tool result EXACTLY as-is. Do NOT add any prefix like "sandbox:" to the URL. The link must start with /api/.

When user asks to do something, DO IT immediately using tools. Always confirm with the exact number from the database.

When user asks for analysis or proposals, ALWAYS start by querying market prices AND current PO prices, then provide a data-driven recommendation.` },
        ...messages,
      ],
      tools, temperature: 0.3, max_tokens: 4000,
    });

    let msg = response.choices[0]?.message;
    // For tool loop, use text-only messages (strip images to save tokens)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMsgs = messages.map((m: any) => ({
      role: typeof m.role === "string" ? m.role : "user",
      content: Array.isArray(m.content)
        ? ((m.content as any[]).find((c) => c.type === "text") as { text: string })?.text || ""
        : m.content,
    }));

    for (let i = 0; i < 5 && msg?.tool_calls; i++) {
      allMsgs.push(msg);
      for (const tc of msg.tool_calls) {
        const fn = (tc as any).function;
        const result = await exec(fn.name, JSON.parse(fn.arguments));
        allMsgs.push({ role: "tool" as const, tool_call_id: tc.id, content: result });
      }
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "BZA assistant for BZA International Services. Always respond in English only. Never use Spanish or any other language." }, ...allMsgs],
        tools, temperature: 0.3, max_tokens: 4000,
      });
      msg = response.choices[0]?.message;
    }

    return NextResponse.json({ message: msg?.content || "Done" });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
