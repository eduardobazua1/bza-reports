import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import Database from "better-sqlite3";
import path from "path";
import { invoices, purchaseOrders, clients, suppliers, supplierPayments, scheduledReports, reportTemplates, shipmentUpdates } from "@/db/schema";
import { eq, sql, count, like, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "query_data", description: "Query business data: summary, clients, suppliers, POs, invoices, payments, shipments", parameters: { type: "object", properties: { query_type: { type: "string", enum: ["summary", "unpaid_invoices", "active_pos", "all_pos", "client_list", "supplier_list", "supplier_payments", "active_shipments", "templates", "scheduled_reports"] }, filter_name: { type: "string" } }, required: ["query_type"] } } },
  { type: "function", function: { name: "create_po", description: "Create purchase order", parameters: { type: "object", properties: { poNumber: { type: "string" }, clientName: { type: "string" }, supplierName: { type: "string" }, sellPrice: { type: "number" }, buyPrice: { type: "number" }, product: { type: "string" }, poDate: { type: "string" }, terms: { type: "string" }, transportType: { type: "string", enum: ["ffcc", "ship", "truck"] }, licenseFsc: { type: "string" }, chainOfCustody: { type: "string" }, inputClaim: { type: "string" }, outputClaim: { type: "string" } }, required: ["poNumber", "clientName", "supplierName", "sellPrice", "buyPrice", "product"] } } },
  { type: "function", function: { name: "create_invoice", description: "Create invoice/shipment on a PO", parameters: { type: "object", properties: { invoiceNumber: { type: "string" }, poNumber: { type: "string" }, quantityTons: { type: "number" }, item: { type: "string" }, shipmentDate: { type: "string" }, vehicleId: { type: "string" }, blNumber: { type: "string" }, currentLocation: { type: "string" } }, required: ["invoiceNumber", "poNumber", "quantityTons"] } } },
  { type: "function", function: { name: "update_invoice", description: "Update invoice: tons, payment status, shipment status, location, dates, vehicle, ETA, BL number. Use this to correct tonnage.", parameters: { type: "object", properties: { invoiceNumber: { type: "string" }, quantityTons: { type: "number", description: "Update the actual tonnage shipped" }, customerPaymentStatus: { type: "string", enum: ["paid", "unpaid"] }, supplierPaymentStatus: { type: "string", enum: ["paid", "unpaid"] }, shipmentStatus: { type: "string", enum: ["programado", "en_transito", "en_aduana", "entregado"] }, shipmentDate: { type: "string" }, currentLocation: { type: "string" }, vehicleId: { type: "string" }, blNumber: { type: "string" }, estimatedArrival: { type: "string", description: "ETA date in YYYY-MM-DD format" }, customerPaidDate: { type: "string" }, invoiceDate: { type: "string" }, paymentTermsDays: { type: "number" }, salesDocument: { type: "string" }, billingDocument: { type: "string" } }, required: ["invoiceNumber"] } } },
  { type: "function", function: { name: "update_po", description: "Update PO: status, prices, dates, certification", parameters: { type: "object", properties: { poNumber: { type: "string" }, status: { type: "string", enum: ["active", "completed", "cancelled"] }, sellPrice: { type: "number" }, buyPrice: { type: "number" }, poDate: { type: "string" }, terms: { type: "string" }, licenseFsc: { type: "string" }, chainOfCustody: { type: "string" }, inputClaim: { type: "string" }, outputClaim: { type: "string" } }, required: ["poNumber"] } } },
  { type: "function", function: { name: "create_supplier_payment", description: "Record a payment to a supplier (advance, wire, deposit)", parameters: { type: "object", properties: { supplierName: { type: "string" }, amountUsd: { type: "number" }, paymentDate: { type: "string" }, estimatedTons: { type: "number" }, pricePerTon: { type: "number" }, poNumber: { type: "string" }, reference: { type: "string" }, notes: { type: "string" } }, required: ["supplierName", "amountUsd", "paymentDate"] } } },
  { type: "function", function: { name: "create_client", description: "Create a new client", parameters: { type: "object", properties: { name: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "create_supplier", description: "Create a new supplier", parameters: { type: "object", properties: { name: { type: "string" }, contactName: { type: "string" }, contactEmail: { type: "string" }, phone: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "delete_record", description: "Delete a PO, invoice, client, supplier, or payment", parameters: { type: "object", properties: { type: { type: "string", enum: ["po", "invoice", "client", "supplier", "payment"] }, identifier: { type: "string", description: "PO number, invoice number, client name, supplier name, or payment ID" } }, required: ["type", "identifier"] } } },
  { type: "function", function: { name: "schedule_report", description: "Schedule a report to be sent to a client", parameters: { type: "object", properties: { clientName: { type: "string" }, templateName: { type: "string" }, sendDate: { type: "string" }, notes: { type: "string" } }, required: ["clientName", "sendDate"] } } },
  { type: "function", function: { name: "generate_report", description: "Generate a PDF or Excel report for a client. Returns a download link. Use when user asks for a report, export, or document.", parameters: { type: "object", properties: { clientName: { type: "string", description: "Client name (fuzzy match)" }, format: { type: "string", enum: ["pdf", "excel"], description: "Report format" }, filter: { type: "string", enum: ["active", "all"], description: "active = only active shipments, all = include delivered" }, columns: { type: "string", description: "Comma-separated column keys. Options: currentLocation,poNumber,invoiceNumber,vehicleId,blNumber,quantityTons,sellPrice,shipmentStatus,shipmentDate,item,terms,transportType,customerPaymentStatus,estimatedArrival,salesDocument,billingDocument,clientPoNumber. Leave empty for defaults." } }, required: ["clientName", "format"] } } },
  { type: "function", function: { name: "run_calculation", description: "Run a SQL query on the database for exact calculations. Use this for any math: sums, totals, averages, counts, filtering. Tables: invoices (invoice_number, purchase_order_id, quantity_tons, sell_price_override, buy_price_override, shipment_date, due_date, customer_payment_status, supplier_payment_status, shipment_status, item, vehicle_id, current_location), purchase_orders (po_number, po_date, client_id, supplier_id, sell_price, buy_price, product, terms, transport_type, status), clients (id, name), suppliers (id, name), supplier_payments (supplier_id, purchase_order_id, amount_usd, payment_date, estimated_tons, notes). Revenue = quantity_tons * COALESCE(sell_price_override, sell_price). Cost = quantity_tons * COALESCE(buy_price_override, buy_price).", parameters: { type: "object", properties: { sql_query: { type: "string", description: "SELECT SQL query to run. Only SELECT allowed, no INSERT/UPDATE/DELETE." } }, required: ["sql_query"] } } },
];

// Alias map for fuzzy client/supplier matching
const ALIASES: Record<string, string[]> = {
  "Kimberly Clark de México": ["kimberly", "kcm", "kc", "kim", "kimberly clark", "kc mexico", "kcm mexico"],
  "Biopappel Scribe, S.A. de C.V.": ["biopappel", "scribe", "biopapel", "bio"],
  "Copamex Industrias S.A. DE C.V.": ["copamex", "copa"],
  "GRUPO CORPORATIVO PAPELERA S.A. DE C.V.": ["grupo corporativo", "gcp", "papelera", "corporativo"],
  "Papelera de Chihuahua S.A. DE C.V.": ["pch", "chihuahua", "papelera chihuahua", "papelera de chihuahua"],
  "Sanitate S. De R.L. De C.V.": ["sanitate", "sani"],
  "Arauco": ["arauco"],
  "Cascade Pacific Pulp (CPP)": ["cascade", "cpp", "cascade pacific", "pacific pulp"],
  "APP of China": ["app", "app china", "app of china"],
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
        const data = await db.select({ poNumber: purchaseOrders.poNumber, clientName: clients.name, supplierName: suppliers.name, sellPrice: purchaseOrders.sellPrice, buyPrice: purchaseOrders.buyPrice, product: purchaseOrders.product }).from(purchaseOrders).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id)).where(eq(purchaseOrders.status, "active"));
        return JSON.stringify(data);
      }
      if (qt === "all_pos") {
        const data = await db.select({ poNumber: purchaseOrders.poNumber, poDate: purchaseOrders.poDate, clientName: clients.name, product: purchaseOrders.product, status: purchaseOrders.status, sellPrice: purchaseOrders.sellPrice, buyPrice: purchaseOrders.buyPrice }).from(purchaseOrders).leftJoin(clients, eq(purchaseOrders.clientId, clients.id)).orderBy(purchaseOrders.poNumber);
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
      if (!cl) return `Client "${args.clientName}" not found. Available: ${(await db.select({ name: clients.name }).from(clients)).map(c => c.name).join(", ")}`;
      if (!su) return `Supplier "${args.supplierName}" not found.`;
      await db.insert(purchaseOrders).values({ poNumber: args.poNumber as string, poDate: (args.poDate as string) || null, clientId: cl.id, supplierId: su.id, sellPrice: args.sellPrice as number, buyPrice: args.buyPrice as number, product: args.product as string, terms: (args.terms as string) || null, transportType: (args.transportType as "ffcc"|"ship"|"truck") || null, licenseFsc: (args.licenseFsc as string) || null, chainOfCustody: (args.chainOfCustody as string) || null, inputClaim: (args.inputClaim as string) || null, outputClaim: (args.outputClaim as string) || null });
      return `PO ${args.poNumber} created: ${cl.name}, ${su.name}, Sell $${args.sellPrice}, Buy $${args.buyPrice}, ${args.product}`;
    }

    if (name === "create_invoice") {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.poNumber, args.poNumber as string) });
      if (!po) return `PO "${args.poNumber}" not found.`;
      await db.insert(invoices).values({ invoiceNumber: args.invoiceNumber as string, purchaseOrderId: po.id, quantityTons: args.quantityTons as number, item: (args.item as string) || null, shipmentDate: (args.shipmentDate as string) || null, vehicleId: (args.vehicleId as string) || null, blNumber: (args.blNumber as string) || null, currentLocation: (args.currentLocation as string) || null });
      return `Invoice ${args.invoiceNumber} created on ${args.poNumber}: ${args.quantityTons} TN`;
    }

    if (name === "update_invoice") {
      const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, args.invoiceNumber as string) });
      if (!inv) return `Invoice "${args.invoiceNumber}" not found.`;
      const ud: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) { if (k !== "invoiceNumber" && v) ud[k] = v; }
      // Auto-set lastLocationUpdate when location changes
      if (args.currentLocation) { ud.lastLocationUpdate = new Date().toISOString(); }
      // Track shipment status changes
      if (args.shipmentStatus && args.shipmentStatus !== inv.shipmentStatus) {
        await db.insert(shipmentUpdates).values({ invoiceId: inv.id, previousStatus: inv.shipmentStatus, newStatus: args.shipmentStatus as string });
      }
      await db.update(invoices).set(ud).where(eq(invoices.id, inv.id));
      return `Invoice ${args.invoiceNumber} updated: ${Object.entries(args).filter(([k]) => k !== "invoiceNumber").map(([k, v]) => `${k}=${v}`).join(", ")}`;
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

    if (name === "create_supplier") {
      const existing = await findSupplier(args.name as string);
      if (existing) return `Supplier "${args.name}" already exists as "${existing.name}"`;
      await db.insert(suppliers).values({ name: args.name as string, contactName: (args.contactName as string) || null, contactEmail: (args.contactEmail as string) || null, phone: (args.phone as string) || null });
      return `Supplier "${args.name}" created`;
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

    if (name === "run_calculation") {
      const query = (args.sql_query as string).trim();
      if (!query.toUpperCase().startsWith("SELECT")) return "Error: Only SELECT queries allowed.";
      try {
        const rawDb = new Database(path.join(process.cwd(), "sqlite.db"));
        const result = rawDb.prepare(query).all();
        rawDb.close();
        return JSON.stringify(result);
      } catch (sqlErr: unknown) {
        return `SQL Error: ${sqlErr instanceof Error ? sqlErr.message : "unknown"}`;
      }
    }

    return "Unknown tool";
  } catch (err: unknown) {
    return `Error: ${err instanceof Error ? err.message : "unknown"}`;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI API key not configured.\n\n1. Go to https://platform.openai.com/api-keys\n2. Add $5 credit\n3. In .env.local add: OPENAI_API_KEY=sk-your-key" }, { status: 400 });
  }

  const { messages: rawMessages } = await req.json();

  // Convert messages with imageUrl to OpenAI vision format
  const messages = rawMessages.map((m: { role: string; content: string; imageUrl?: string }) => {
    if (m.imageUrl && m.role === "user") {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: m.imageUrl, detail: "high" } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  try {
    let response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `You are the AI assistant for BZA International Services (cellulose/pulp trading, McAllen TX).

## FILE PROCESSING
- When the user uploads an Excel or PDF, the text content is included in their message. Read it carefully and extract the relevant data.
- When the user uploads an image, you can SEE it via GPT-4o vision. Read all text, tables, numbers, and status information visible in the image.
- When processing shipment status updates from clients: extract invoice numbers, vehicle IDs, BL numbers, locations, ETAs, and status changes. Then use update_invoice to update each one.
- Always confirm what you extracted and what you updated.

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

## CLIENT/SUPPLIER ALIASES
The system auto-resolves abbreviations. These all work:
- "kimberly", "kcm", "kc", "kim" → Kimberly Clark de México
- "biopappel", "scribe", "bio" → Biopappel Scribe
- "copamex", "copa" → Copamex Industrias
- "gcp", "grupo corporativo", "papelera" → GRUPO CORPORATIVO PAPELERA
- "pch", "chihuahua" → Papelera de Chihuahua
- "sanitate", "sani" → Sanitate
- "cascade", "cpp" → Cascade Pacific Pulp (CPP)
- "arauco" → Arauco
- "app" → APP of China
Always use the clientName/supplierName as the user provides it — the system will resolve it.

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

## CAPABILITIES
You can: query/calculate data, create POs/invoices/clients/suppliers, record supplier payments, update any field on invoices or POs, delete records, schedule reports, generate PDF/Excel reports.

When user asks for a report or export, use generate_report immediately. CRITICAL: Copy the markdown download link from the tool result EXACTLY as-is. Do NOT add any prefix like "sandbox:" to the URL. The link must start with /api/.

When user asks to do something, DO IT immediately using tools. Always confirm with the exact number from the database.` },
        ...messages,
      ],
      tools, temperature: 0.3, max_tokens: 4000,
    });

    let msg = response.choices[0]?.message;
    // For tool loop, use text-only messages (strip images to save tokens)
    const allMsgs = messages.map((m: { role: string; content: string | object[] }) => ({
      role: typeof m.role === "string" ? m.role : "user",
      content: Array.isArray(m.content)
        ? (m.content.find((c: { type: string }) => c.type === "text") as { text: string })?.text || ""
        : m.content,
    }));

    for (let i = 0; i < 5 && msg?.tool_calls; i++) {
      allMsgs.push(msg);
      for (const tc of msg.tool_calls) {
        const result = await exec(tc.function.name, JSON.parse(tc.function.arguments));
        allMsgs.push({ role: "tool" as const, tool_call_id: tc.id, content: result });
      }
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "BZA assistant. Respond in English, confirm actions." }, ...allMsgs],
        tools, temperature: 0.3, max_tokens: 4000,
      });
      msg = response.choices[0]?.message;
    }

    return NextResponse.json({ message: msg?.content || "Done" });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
