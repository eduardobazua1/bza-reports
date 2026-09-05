import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Audit / activity log — who did what, when (field-level diffs in `changes`)
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  userName: text("user_name"),
  userEmail: text("user_email"),
  action: text("action").notNull(),        // create | update | delete | login | logout | view | export | send | pay
  entity: text("entity").notNull(),         // invoice | purchase_order | client | supplier | payment | user | page ...
  entityId: text("entity_id"),
  entityLabel: text("entity_label"),        // human label, e.g. invoice number / client name
  changes: text("changes"),                 // JSON: [{ field, before, after }]
  meta: text("meta"),                       // JSON: extra context (ip, path, etc.)
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
  city: text("city"),
  country: text("country"),
  paymentTermsDays: integer("payment_terms_days"), // e.g. 60 = Net 60
  // FSC/PEFC certification
  certType: text("cert_type"),
  fscLicense: text("fsc_license"),
  fscChainOfCustody: text("fsc_chain_of_custody"),
  fscInputClaim: text("fsc_input_claim"),
  fscOutputClaim: text("fsc_output_claim"),
  pefc: text("pefc"),
  accessToken: text("access_token").notNull().unique(),
  portalEnabled: integer("portal_enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  country: text("country"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  address: text("address"),
  website: text("website"),
  notes: text("notes"),
  // Contact
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  // Bank information
  bankName: text("bank_name"),
  bankBeneficiary: text("bank_beneficiary"),
  bankAccount: text("bank_account"),
  bankRouting: text("bank_routing"),
  bankSwift: text("bank_swift"),
  bankAddress: text("bank_address"),
  // FSC/PEFC certification
  certType: text("cert_type"),   // "fsc" | "pefc"
  fscLicense: text("fsc_license"),
  fscChainOfCustody: text("fsc_chain_of_custody"),
  fscInputClaim: text("fsc_input_claim"),
  fscOutputClaim: text("fsc_output_claim"),
  pefc: text("pefc"),            // PEFC number (when certType = "pefc")
  certFileName:  text("cert_file_name"),
  certFileUrl:   text("cert_file_url"),
  certFileSize:  integer("cert_file_size"),
  certFile2Name: text("cert_file2_name"),
  certFile2Url:  text("cert_file2_url"),
  certFile2Size: integer("cert_file2_size"),
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

export const contracts = sqliteTable("contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contractNumber: text("contract_number").notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  product: text("product"),
  status: text("status", { enum: ["draft", "active", "expired", "cancelled"] }).notNull().default("draft"),
  // Volume
  volumeTons: real("volume_tons"),
  volumeFrequency: text("volume_frequency", { enum: ["total", "monthly", "quarterly"] }).notNull().default("total"),
  // Validity
  startDate: text("start_date"),
  endDate: text("end_date"),
  // Sell side (BZA → Client)
  sellPriceType: text("sell_price_type", { enum: ["fixed", "cost_plus", "market_plus"] }).notNull().default("fixed"),
  sellPrice: real("sell_price"),
  sellMargin: real("sell_margin"),
  sellMarketRef: text("sell_market_ref"),
  sellIncoterm: text("sell_incoterm"),
  sellPaymentDays: integer("sell_payment_days"),
  // Buy side (BZA ← Supplier)
  buyPriceType: text("buy_price_type", { enum: ["fixed", "cost_plus", "market_plus"] }).notNull().default("fixed"),
  buyPrice: real("buy_price"),
  buyMargin: real("buy_margin"),
  buyMarketRef: text("buy_market_ref"),
  buyIncoterm: text("buy_incoterm"),
  buyPaymentDays: integer("buy_payment_days"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poNumber: text("po_number").notNull().unique(),
  poDate: text("po_date"),
  contractId: integer("contract_id").references(() => contracts.id),
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
  plannedTons: real("planned_tons").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
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
  // Per-invoice certification override (null = inherit from PO). For mixed POs where some
  // cars are "PEFC/FSC Certified" and others are "Controlled Sources"/none.
  certType: text("cert_type"), // "pefc" | "fsc" | "none" | null (null = inherit PO)
  outputClaim: text("output_claim"), // e.g. "100% PEFC Certified"; null = inherit PO
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

// Supplier payment → invoice coverage (many invoices per payment)
export const supplierPaymentInvoices = sqliteTable("supplier_payment_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentId: integer("payment_id").notNull().references(() => supplierPayments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  invoiceNumber: text("invoice_number").notNull(),
  estimatedTons: real("estimated_tons"),
});

// Supplier Invoices (facturas del proveedor) - per PO, for FSC/PEFC audit + A/P reconciliation
export const supplierInvoices = sqliteTable("supplier_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: text("invoice_date"),
  estimatedTons: real("estimated_tons"),
  amountUsd: real("amount_usd"),
  notes: text("notes"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  linkedInvoiceId: integer("linked_invoice_id").references(() => invoices.id),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  // CoC audit evidence (extracted from the supplier's transaction documents — never inferred)
  supplierStatementRaw: text("supplier_statement_raw"),      // verbatim fibre/CoC line from the supplier doc
  supplierCertDocumented: text("supplier_cert_documented"),  // cert code as printed on the doc, or "Not stated…"
  inputClaimEvidenced: text("input_claim_evidenced"),        // registrable input claim, or "No … Claim Evidenced"
  evidenceSource: text("evidence_source"),                   // Supplier Invoice / Packing List / Bill of Lading / Multiple Documents / Not Evidenced
  auditValidation: text("audit_validation"),                 // last computed validation snapshot
});

// Customer Certification Master — BZA may only transfer an FSC/PEFC claim to a customer with a valid certificate.
export const customerCertificates = sqliteTable("customer_certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  scheme: text("scheme").notNull(),                          // 'fsc' | 'pefc'
  certificateNumber: text("certificate_number"),
  certifier: text("certifier"),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("pending"),       // 'valid' | 'expired' | 'suspended' | 'pending'
  verificationSource: text("verification_source"),
  lastVerifiedAt: text("last_verified_at"),
  fileName: text("file_name"),                               // attached certificate PDF
  fileUrl: text("file_url"),                                 // base64 data URL
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

// Customer payments received (one payment can cover multiple invoices)
export const customerPayments = sqliteTable("customer_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  paymentDate: text("payment_date").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("wire_transfer"),
  // wire_transfer | cv_credit | xepellin | factoraje_bbva | biopappel_scribe | other
  referenceNo: text("reference_no"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Junction: which invoices were covered by a customer payment
export const customerPaymentInvoices = sqliteTable("customer_payment_invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentId: integer("payment_id").notNull().references(() => customerPayments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  invoiceNumber: text("invoice_number").notNull(),
  amount: real("amount").notNull(),
});

// Email send history for invoices
// Log of each time a Supplier Order (PO to supplier) PDF was emailed.
// Enables re-sending and a real send history that persists across reloads.
export const supplierOrderSends = sqliteTable("supplier_order_sends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierOrderId: integer("supplier_order_id").notNull().references(() => supplierOrders.id),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  sentAt: text("sent_at").notNull().$defaultFn(() => new Date().toISOString()),
  sentTo: text("sent_to").notNull(),
  note: text("note"), // optional, e.g. "corrected version"
});

export const invoiceEmailLogs = sqliteTable("invoice_email_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  invoiceNumber: text("invoice_number").notNull(),
  sentAt: text("sent_at").notNull().$defaultFn(() => new Date().toISOString()),
  sentTo: text("sent_to").notNull(),
  sentCc: text("sent_cc"),
  attachmentCount: integer("attachment_count").default(1),
  trackingId: text("tracking_id").notNull().unique(),
  openCount: integer("open_count").default(0),
  firstOpenedAt: text("first_opened_at"),
  lastOpenedAt: text("last_opened_at"),
});

// Documents attached to invoices (BL, PL, Invoice PDF, etc.)
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  type: text("type", { enum: ["invoice", "bl", "pl", "other", "supplier_invoice"] }).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: text("uploaded_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Proposals — sent to clients before a purchase order
export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalNumber: text("proposal_number").notNull().unique(), // e.g. PRO-001
  clientId: integer("client_id").notNull().references(() => clients.id),
  title: text("title").notNull().default("Proposal"),
  proposalDate: text("proposal_date").notNull(),
  validUntil: text("valid_until"),
  status: text("status", { enum: ["draft", "sent", "accepted", "declined"] }).notNull().default("draft"),
  incoterm: text("incoterm"),      // e.g. "DAP Eagle Pass, TX"
  paymentTerms: text("payment_terms"), // e.g. "Net 60"
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Proposal line items
export const proposalItems = sqliteTable("proposal_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull().references(() => proposals.id),
  sort: integer("sort").notNull().default(0),   // display order
  product: text("product").notNull(),            // e.g. "NBSK - Northern Bleached Softwood Kraft"
  description: text("description"),             // extra spec info
  tons: real("tons").notNull().default(0),
  unit: text("unit").notNull().default("MT"),    // MT | ADMT
  pricePerTon: real("price_per_ton").notNull().default(0),
  certType: text("cert_type"),                  // FSC / PEFC / None
  certDetail: text("cert_detail"),              // e.g. FSC-C005174
});

// Credit memos — issued to clients as discounts or adjustments on invoices
export const creditMemos = sqliteTable("credit_memos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  creditNumber: text("credit_number"),
  amount: real("amount").notNull(), // positive = credit to client
  memoDate: text("memo_date").notNull(),
  reason: text("reason"),
  status: text("status", { enum: ["open", "applied", "void"] }).notNull().default("open"),
  appliedDate: text("applied_date"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Push notification subscriptions — one row per browser/device that subscribed
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh:   text("p256dh").notNull(),
  auth:     text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =============================================================================
// FINANCIAL MODULE — Bank accounts, transactions, OpEx, capital, period close
// =============================================================================

// Bank accounts BZA operates (Vantage Checking #45161, Money Market #45069, etc.)
export const bankAccounts = sqliteTable("bank_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                          // "Vantage Business Checking"
  bank: text("bank").notNull(),                          // "Vantage Bank Texas"
  accountNumberMasked: text("account_number_masked").notNull(), // "XXX45161"
  accountType: text("account_type", { enum: ["checking", "money_market", "savings", "other"] }).notNull(),
  currency: text("currency").notNull().default("USD"),
  openingBalance: real("opening_balance").notNull().default(0),
  openingDate: text("opening_date").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  plaidItemId: integer("plaid_item_id"),                 // links to plaidItems when connected via Plaid
  plaidAccountId: text("plaid_account_id"),              // Plaid's account_id for this account
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Plaid bank connections — one row per linked institution (holds the access token).
export const plaidItems = sqliteTable("plaid_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institution: text("institution"),
  cursor: text("cursor"),                                 // transactions/sync cursor
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Bank transactions — every line from bank statements (imported via CSV/PDF or Plaid)
export const bankTransactions = sqliteTable("bank_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bankAccountId: integer("bank_account_id").notNull().references(() => bankAccounts.id),
  plaidTransactionId: text("plaid_transaction_id"),        // Plaid's transaction_id (dedupe key)
  transactionDate: text("transaction_date").notNull(),     // YYYY-MM-DD
  amount: real("amount").notNull(),                        // signed: positive=credit, negative=debit
  balanceAfter: real("balance_after"),                     // running balance if available from statement
  descriptionRaw: text("description_raw").notNull(),       // verbatim from bank
  vendorName: text("vendor_name"),                         // extracted/inferred counterparty
  // Categorization
  category: text("category", { enum: [
    "Revenue", "COGS", "OpEx", "Capital", "Distribution",
    "Other Income", "Internal Transfer", "Uncategorized"
  ] }).notNull().default("Uncategorized"),
  subcategory: text("subcategory"),                        // e.g. "Wire Fees", "Commissions — Sasson"
  manuallyCategorized: integer("manually_categorized", { mode: "boolean" }).notNull().default(false),
  // Reconciliation to other records
  reconciledInvoiceId: integer("reconciled_invoice_id").references(() => invoices.id),
  reconciledSupplierPaymentId: integer("reconciled_supplier_payment_id").references(() => supplierPayments.id),
  reconciledOpExpenseId: integer("reconciled_op_expense_id"),  // forward ref — operatingExpenses below
  reconciledCapitalId: integer("reconciled_capital_id"),       // forward ref — capitalMovements below
  // Internal transfer pairing — both halves should sum to 0
  internalTransferPairId: integer("internal_transfer_pair_id"),
  // Import provenance
  importedFrom: text("imported_from"),                     // filename or "manual"
  importedAt: text("imported_at").notNull().$defaultFn(() => new Date().toISOString()),
  // Period locking
  accountingPeriodId: integer("accounting_period_id"),     // forward ref — accountingPeriods below
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Pattern-based rules for auto-categorizing imported bank transactions
export const transactionCategoryRules = sqliteTable("transaction_category_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Matching: case-insensitive substring match on description_raw
  pattern: text("pattern").notNull(),                      // e.g. "CELULOSA ARAUCO", "EULER HERMES"
  matchType: text("match_type", { enum: ["contains", "starts_with", "regex"] }).notNull().default("contains"),
  // Output classification
  category: text("category", { enum: [
    "Revenue", "COGS", "OpEx", "Capital", "Distribution",
    "Other Income", "Internal Transfer", "Uncategorized"
  ] }).notNull(),
  subcategory: text("subcategory"),
  vendorName: text("vendor_name"),
  // If this rule should also reconcile to a specific entity
  defaultReconcileType: text("default_reconcile_type", { enum: ["invoice", "supplier_payment", "op_expense", "capital", "none"] }).notNull().default("none"),
  // Priority — higher wins (e.g. "WIRE FEE" rule should beat customer name rule because fees contain customer names)
  priority: integer("priority").notNull().default(100),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Operating expenses (commissions, prof services, bank fees, insurance, etc.)
export const operatingExpenses = sqliteTable("operating_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseDate: text("expense_date").notNull(),
  category: text("category").notNull(),                    // "Commissions", "Professional Services", etc.
  vendor: text("vendor").notNull(),                        // "Salvador Sasson", "Drage CPA"
  amount: real("amount").notNull(),                        // positive number = expense
  currency: text("currency").notNull().default("USD"),
  // Optional linkage
  bankTransactionId: integer("bank_transaction_id").references(() => bankTransactions.id),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  // Period locking
  accountingPeriodId: integer("accounting_period_id"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Capital movements: contributions from members, distributions, return of capital
export const capitalMovements = sqliteTable("capital_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  movementDate: text("movement_date").notNull(),
  movementType: text("movement_type", { enum: [
    "contribution",         // member puts capital in
    "distribution",         // distribution to member (taxable)
    "owner_personal",       // payment for owner's personal use (e.g. Capital One CC, personal wires)
    "spouse_business",      // wires for spouse-related business (not BZA)
    "return_of_capital"     // return of capital to member (reduces basis, not taxable)
  ] }).notNull(),
  memberName: text("member_name").notNull(),               // "CREA Investments BZA LLC", "Jesús E. Bazua", etc.
  amount: real("amount").notNull(),                        // positive = inflow to BZA equity; negative = outflow
  currency: text("currency").notNull().default("USD"),
  bankTransactionId: integer("bank_transaction_id").references(() => bankTransactions.id),
  accountingPeriodId: integer("accounting_period_id"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Accounting periods — monthly close workflow
export const accountingPeriods = sqliteTable("accounting_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),          // 1-12
  status: text("status", { enum: ["open", "closing", "closed", "published"] }).notNull().default("open"),
  closedAt: text("closed_at"),
  closedByUserId: integer("closed_by_user_id").references(() => users.id),
  publishedAt: text("published_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Period balance snapshots — frozen at close, used for historical reporting and BS roll-forward
export const periodSnapshots = sqliteTable("period_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountingPeriodId: integer("accounting_period_id").notNull().references(() => accountingPeriods.id),
  lineItem: text("line_item").notNull(),                   // e.g. "Cash — #XXX45161", "AR — Kimberly Clark", "Total Equity"
  lineCategory: text("line_category", { enum: [
    "asset_cash", "asset_ar", "asset_inventory", "asset_supplier_prepay", "asset_other",
    "liability_ap", "liability_customer_deposit", "liability_debt", "liability_accrued", "liability_other",
    "equity_contributed", "equity_distributed", "equity_retained", "equity_total"
  ] }).notNull(),
  amount: real("amount").notNull(),
  source: text("source", { enum: ["computed", "manual_adjustment"] }).notNull().default("computed"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// BZA Compliance Certificates (FSC CoC, PEFC CoC, etc.)
export const certificates = sqliteTable("certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                       // "FSC Chain of Custody"
  certType: text("cert_type").notNull(),               // "fsc" | "pefc" | "other"
  certCode: text("cert_code"),                         // "CU-COC-892954"
  issuedBy: text("issued_by"),                         // "Control Union Certifications"
  issuedTo: text("issued_to"),                         // "BZA International Services LLC"
  validFrom: text("valid_from"),                       // "2023-01-30"
  validUntil: text("valid_until"),                     // "2028-01-29"
  standard: text("standard"),                          // FSC-STD-40-004 V3-1 ...
  notes: text("notes"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),                           // base64 data URL
  fileSize: integer("file_size"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Documents for the FSC/PEFC audit package (handbook, labor assessment, etc.), stored to download & send.
export const auditDocuments = sqliteTable("audit_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemKey: text("item_key").notNull(),   // which of the 10 checklist items (e.g. "procedures", "labor", ...)
  cert: text("cert"),                     // "fsc" | "pefc" | "both" | null
  title: text("title"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),    // base64 data URL
  fileSize: integer("file_size"),
  uploadedAt: text("uploaded_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// --- BZA Intelligence (AI assistant) memory & conversation history ---

// Durable business facts/rules the assistant learns and applies automatically
// (e.g. "Desarrollos Tecnológicos = Biopappel commission agent → OpEx").
export const aiMemory = sqliteTable("ai_memory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fact: text("fact").notNull(),
  topic: text("topic"),                       // e.g. commissions, entities, categorization, clients
  source: text("source", { enum: ["user", "ai"] }).notNull().default("ai"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// Saved chat threads so past conversations can be reopened and searched.
export const aiConversations = sqliteTable("ai_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("New conversation"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const aiMessages = sqliteTable("ai_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  imageUrls: text("image_urls"),              // JSON array of data URLs (optional)
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
