import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const db = new Database(path.join(process.cwd(), "sqlite.db"));
db.pragma("foreign_keys = ON");

const filePath = path.resolve(
  process.env.HOME || "",
  "Library/Mobile Documents/com~apple~CloudDocs/PEFC : BZA/PEFC 2025/Sales Aging Report..2025.xlsx"
);

console.log("Reading:", filePath);
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets["Hoja1 (2)"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];

const existingPOs = new Set((db.prepare("SELECT po_number FROM purchase_orders").all() as { po_number: string }[]).map(r => r.po_number));
const existingInvs = new Set((db.prepare("SELECT invoice_number FROM invoices").all() as { invoice_number: string }[]).map(r => r.invoice_number));

const clientMap = new Map<string, number>();
for (const c of db.prepare("SELECT id, name FROM clients").all() as { id: number; name: string }[]) {
  clientMap.set(c.name, c.id);
}
const supplierMap = new Map<string, number>();
for (const s of db.prepare("SELECT id, name FROM suppliers").all() as { id: number; name: string }[]) {
  supplierMap.set(s.name, s.id);
}

const kcId = clientMap.get("Kimberly Clark de México");

function getClientId(name: string): number | null {
  if (clientMap.has(name)) return clientMap.get(name)!;
  if (name.includes("imberly") || name.includes("KC")) return kcId || null;
  const result = db.prepare("INSERT INTO clients (name, access_token, portal_enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run(
    name, uuidv4(), new Date().toISOString(), new Date().toISOString()
  );
  clientMap.set(name, Number(result.lastInsertRowid));
  console.log("  New client:", name);
  return Number(result.lastInsertRowid);
}

function getSupplierId(name: string): number | null {
  if (supplierMap.has(name)) return supplierMap.get(name)!;
  if (name === "CPP") return supplierMap.get("Cascade Pacific Pulp (CPP)") || null;
  for (const [k, v] of supplierMap) {
    if (k.includes(name) || name.includes(k.split(",")[0])) return v;
  }
  return null;
}

function excelDateToISO(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    if (val === "pending") return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  if (typeof val === "number") {
    const utcDays = Math.floor(val - 25569);
    return new Date(utcDays * 86400 * 1000).toISOString().split("T")[0];
  }
  return null;
}

let newPOs = 0, newInvs = 0, skipped = 0;
const now = new Date().toISOString();

for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 10) continue;

  const poNumber = row[1] as string;
  const customer = row[6] as string;
  const quantity = row[12] as number;
  const supplier = row[15] as string;
  const sellPrice = row[16] as number;
  const invoiceNumber = row[3] as string;

  if (!poNumber || customer === "TOTAL" || !quantity || !supplier || !invoiceNumber) continue;
  if (typeof quantity !== "number" || quantity <= 0) continue;
  if (poNumber === "no se realizo") continue;

  const poDate = excelDateToISO(row[2]);
  const customerPO = row[7] as string;
  const licenseFsc = row[8] as string;
  const chainOfCustody = row[9] as string;
  const inputClaim = row[10] as string;
  const outputClaim = row[14] as string;
  const buyPrice = row[18] as number;
  const shipmentDate = excelDateToISO(row[27]);
  const paymentStatus = row[28] as string;
  const item = row[29] as string;
  const terms = row[30] as string;
  const transportType = row[31] as string;

  if (!existingPOs.has(poNumber)) {
    const clientId = getClientId(customer);
    const supplierId = getSupplierId(supplier);
    if (!clientId || !supplierId || !sellPrice || !buyPrice) {
      console.log("  Skip PO", poNumber, "- missing data");
      continue;
    }

    const tt = transportType?.toLowerCase() === "ffcc" ? "ffcc" : transportType?.toLowerCase()?.includes("ship") ? "ship" : transportType?.toLowerCase() === "truck" ? "truck" : null;

    db.prepare(`INSERT INTO purchase_orders (po_number, po_date, client_id, client_po_number, supplier_id, sell_price, buy_price, product, terms, transport_type, license_fsc, chain_of_custody, input_claim, output_claim, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      poNumber, poDate, clientId, customerPO?.toString() || null, supplierId,
      sellPrice, buyPrice, item || "Unknown", terms || null, tt,
      licenseFsc?.toString() || null, chainOfCustody?.toString() || null,
      inputClaim?.toString() || null, outputClaim?.toString() || null,
      "active", now, now
    );
    existingPOs.add(poNumber);
    newPOs++;
    console.log("  New PO:", poNumber);
  }

  if (!existingInvs.has(invoiceNumber)) {
    const po = db.prepare("SELECT id, sell_price, buy_price FROM purchase_orders WHERE po_number = ?").get(poNumber) as { id: number; sell_price: number; buy_price: number } | undefined;
    if (!po) { skipped++; continue; }

    const sellOverride = (typeof sellPrice === "number" && sellPrice !== po.sell_price) ? sellPrice : null;
    const buyOverride = (typeof buyPrice === "number" && buyPrice !== po.buy_price) ? buyPrice : null;

    db.prepare(`INSERT INTO invoices (invoice_number, purchase_order_id, quantity_tons, unit, sell_price_override, buy_price_override, shipment_date, shipment_status, customer_payment_status, supplier_payment_status, uses_factoring, item, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      invoiceNumber, po.id, quantity, "Ton", sellOverride, buyOverride,
      shipmentDate, paymentStatus?.toLowerCase() === "paid" ? "entregado" : "programado",
      paymentStatus?.toLowerCase() === "paid" ? "paid" : "unpaid",
      paymentStatus?.toLowerCase() === "paid" ? "paid" : "unpaid",
      0, item || null, now, now
    );
    existingInvs.add(invoiceNumber);
    newInvs++;
  } else {
    skipped++;
  }
}

console.log(`\nDone! New POs: ${newPOs}, New Invoices: ${newInvs}, Skipped: ${skipped}`);
const totalPOs = (db.prepare("SELECT COUNT(*) as c FROM purchase_orders").get() as { c: number }).c;
const totalInvs = (db.prepare("SELECT COUNT(*) as c FROM invoices").get() as { c: number }).c;
console.log(`Total in DB: ${totalPOs} POs, ${totalInvs} invoices`);
