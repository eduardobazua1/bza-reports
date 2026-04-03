import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  billAddress: text("bill_address"),
  shipAddress: text("ship_address"),
  rfc: text("rfc"),
  paymentTermsDays: integer("payment_terms_days"), // e.g. 60 = Net 60
  // FSC/PEFC certification
  fscLicense: text("fsc_license"),
  fscChainOfCustody: text("fsc_chain_of_custody"),
  fscInputClaim: text("fsc_input_claim"),
  fscOutputClaim: text("fsc_output_claim"),
  accessToken: text("access_token").notNull().unique(),
  portalEnabled: integer("portal_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  // FSC/PEFC certification
  fscLicense: text("fsc_license"),
  fscChainOfCustody: text("fsc_chain_of_custody"),
  fscInputClaim: text("fsc_input_claim"),
  fscOutputClaim: text("fsc_output_claim"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  grade: text("grade"), // e.g. NBSK, SBSK, BHK, BCTMP
  description: text("description"),
  notes: text("notes"),
  // FSC/PEFC certification fields
  fscLicense: text("fsc_license"),           // e.g. FSC-C005174
  chainOfCustody: text("chain_of_custody"),  // e.g. SCS-CW-000885
  inputClaim: text("input_claim"),           // e.g. "FSC Controlled Wood"
  outputClaim: text("output_claim"),         // e.g. "FSC Controlled Wood"
  pefc: text("pefc"),                        // e.g. PEFC-2431400 (null if FSC only)
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poNumber: text("po_number").notNull().unique(),
  poDate: text("po_date"),
  clientId: integer("client_id").notNull().references(() => clients.id),
  clientPoNumber: text("client_po_number"),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  sellPrice: real("sell_price").notNull(), // USD per ton
  buyPrice: real("buy_price").notNull(), // USD per ton
  product: text("product").notNull(),
  supplierProductId: integer("supplier_product_id").references(() => products.id),
  clientProductId: integer("client_product_id").references(() => products.id),
  terms: text("terms"),
  transportType: text("transport_type", { enum: ["ffcc", "ship", "truck"] }),
  licenseFsc: text("license_fsc"),
  chainOfCustody: text("chain_of_custody"),
  inputClaim: text("input_claim"),
  outputClaim: text("output_claim"),
  certType: text("cert_type", { enum: ["fsc", "pefc"] }), // which certification applies to this PO
  pefc: text("pefc"), // PEFC certificate number (used when certType = 'pefc')
  status: text("status", { enum: ["active", "completed", "cancelled"] }).notNull().default("active"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  quantityTons: real("quantity_tons").notNull(),
  unit: text("unit").notNull().default("Ton"),
  sellPriceOverride: real("sell_price_override"), // null = use PO price
  buyPriceOverride: real("buy_price_override"), // null = use PO price
  freightCost: real("freight_cost").default(0), // additional transport/freight cost
  shipmentDate: text("shipment_date"),
  estimatedArrival: text("estimated_arrival"),
  shipmentStatus: text("shipment_status", {
    enum: ["programado", "en_transito", "en_aduana", "entregado"],
  }).notNull().default("programado"),
  customerPaymentStatus: text("customer_payment_status", {
    enum: ["paid", "unpaid"],
  }).notNull().default("unpaid"),
  supplierPaymentStatus: text("supplier_payment_status", {
    enum: ["paid", "unpaid"],
  }).notNull().default("unpaid"),
  usesFactoring: integer("uses_factoring", { mode: "boolean" }).notNull().default(false),
  factoringAmount: real("factoring_amount"),
  factoringDays: integer("factoring_days"),
  factoringCost: real("factoring_cost"),
  item: text("item"), // e.g. "White Gold 316"
  destination: text("destination"), // final destination (e.g. "Ecatepec") — separate from currentLocation
  balesCount: integer("bales_count"), // number of bales (from BOL)
  unitsPerBale: integer("units_per_bale"), // units per bale (from BOL)
  // Tracking fields (for client reports like KC)
  currentLocation: text("current_location"),
  lastLocationUpdate: text("last_location_update"),
  vehicleId: text("vehicle_id"), // railcar/truck ID (e.g. TBOX666789)
  blNumber: text("bl_number"), // Bill of Lading
  clientPoId: integer("client_po_id").references(() => clientPurchaseOrders.id), // link to client PO
  salesDocument: text("sales_document"), // client's sales doc number
  billingDocument: text("billing_document"), // client's billing doc number
  // Invoice aging fields (double-check with QuickBooks)
  invoiceDate: text("invoice_date"), // when invoice was issued
  paymentTermsDays: integer("payment_terms_days"), // e.g. 30, 60, 90
  dueDate: text("due_date"), // calculated or manual: invoiceDate + paymentTermsDays
  customerPaidDate: text("customer_paid_date"), // actual date client paid
  supplierInvoiceNumber: text("supplier_invoice_number"), // supplier's invoice # for reference
  supplierPaidDate: text("supplier_paid_date"), // actual date we paid supplier
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const shipmentUpdates = sqliteTable("shipment_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  comment: text("comment"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Report templates - predefined column sets for sending to clients
export const reportTemplates = sqliteTable("report_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g. "Tracking KC", "Reporte Scribe"
  description: text("description"),
  format: text("format", { enum: ["excel", "portal-link"] }).notNull().default("excel"),
  columns: text("columns").notNull(), // JSON array of column keys
  subject: text("subject"), // email subject template
  message: text("message"), // email body template
  defaultReminderEmail: text("default_reminder_email"), // default person to remind
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false), // system templates can't be deleted
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Scheduled reports - when to send which template to which client
export const scheduledReports = sqliteTable("scheduled_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  templateId: integer("template_id").notNull().references(() => reportTemplates.id),
  sendDate: text("send_date").notNull(), // when to send
  reminderEmail: text("reminder_email"), // who to remind (email)
  status: text("status", { enum: ["pending", "sent", "cancelled"] }).notNull().default("pending"),
  sentAt: text("sent_at"), // actual send time
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Client Purchase Orders - sub-orders from client under a BZA PO
// e.g. BZA PO X0043 → Client PO X189014 (Morelia, 270 TN)
export const clientPurchaseOrders = sqliteTable("client_purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  clientPoNumber: text("client_po_number").notNull(), // e.g. X189014
  destination: text("destination"), // e.g. "Morelia"
  plannedTons: real("planned_tons"), // e.g. 270
  item: text("item"), // product name for this client order
  incoterm: text("incoterm"), // incoterm specific to this order
  sellPriceOverride: real("sell_price_override"), // price override for this order
  status: text("status", { enum: ["pending", "partial", "complete"] }).notNull().default("pending"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Supplier payments - advance payments, deposits, and settlement tracking
export const supplierPayments = sqliteTable("supplier_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  invoiceId: integer("invoice_id").references(() => invoices.id), // optional: linked to specific shipment
  amountUsd: real("amount_usd").notNull(), // amount paid (advance/estimated)
  paymentDate: text("payment_date").notNull(),
  // Estimated (at time of payment)
  estimatedTons: real("estimated_tons"), // tons expected when payment was made
  pricePerTon: real("price_per_ton"), // agreed price per ton
  // Actual (after shipment - auto-calculated or manual)
  actualTons: real("actual_tons"), // real tons shipped (from invoice)
  actualAmount: real("actual_amount"), // real amount = actualTons × pricePerTon
  adjustmentAmount: real("adjustment_amount"), // difference: amountUsd - actualAmount (+ = overpaid, - = underpaid)
  adjustmentStatus: text("adjustment_status", { enum: ["pending", "settled", "na"] }).default("na"),
  // Legacy field kept for backward compatibility
  tons: real("tons"),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Supplier Orders - individual purchase orders sent to supplier under a BZA PO
// e.g. BZA PO X0043 → Supplier Order 1: 540 TN @ $845/TN DAP Eagle Pass
export const supplierOrders = sqliteTable("supplier_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  orderDate: text("order_date"),
  tons: real("tons").notNull(), // total tons (sum of lines)
  pricePerTon: real("price_per_ton"), // null = use PO buyPrice
  incoterm: text("incoterm"), // null = use PO terms
  item: text("item"), // product name shown on the PDF
  lines: text("lines"), // JSON: [{destination, tons, notes}]
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Market prices from TTO and RISI
export const marketPrices = sqliteTable("market_prices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(), // TTO, RISI
  grade: text("grade").notNull(), // NBSK, SBSK, BHK
  region: text("region").notNull(), // North America, Europe, China
  month: text("month").notNull(), // 2026-03
  price: real("price").notNull(),
  priceType: text("price_type").notNull().default("net"), // list, net, derived
  changeValue: real("change_value"), // +/- from source (TTO/RISI published change)
  unit: text("unit").notNull().default("USD/ADMT"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Portal users - authorized client contacts who can access the portal
export const portalUsers = sqliteTable("portal_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLogin: text("last_login"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Portal verification codes - temporary codes for email login
export const portalCodes = sqliteTable("portal_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  portalUserId: integer("portal_user_id").notNull().references(() => portalUsers.id),
  code: text("code").notNull(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// App settings - key-value store for configurable settings
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Documents attached to invoices (BL, PL, Invoice PDF, etc.)
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  type: text("type", { enum: ["invoice", "bl", "pl", "other"] }).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: text("uploaded_at").notNull().$defaultFn(() => new Date().toISOString()),
});
