import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import path from "path";

const db = new Database(path.join(process.cwd(), "sqlite.db"));
const filePath = path.resolve(
  process.env.HOME || "",
  "Library/Mobile Documents/com~apple~CloudDocs/PEFC : BZA/PEFC 2025/Sales Aging Report..2025.xlsx"
);

console.log("Reading Excel to fix payment statuses...");
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets["Hoja1 (2)"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];

let updated = 0;
let alreadyCorrect = 0;

for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length < 10) continue;

  const invoiceNumber = row[3] as string;
  const customer = row[6] as string;
  const paymentStatus = row[28] as string; // Column AC = Status Customer

  if (!invoiceNumber || customer === "TOTAL") continue;

  const isPaid = paymentStatus?.toLowerCase()?.trim() === "paid";
  const dbStatus = isPaid ? "paid" : "unpaid";
  const shipStatus = isPaid ? "entregado" : "programado";

  // Get current DB status
  const inv = db.prepare("SELECT id, customer_payment_status, shipment_status FROM invoices WHERE invoice_number = ?").get(invoiceNumber) as {
    id: number; customer_payment_status: string; shipment_status: string;
  } | undefined;

  if (!inv) continue;

  if (inv.customer_payment_status !== dbStatus) {
    db.prepare("UPDATE invoices SET customer_payment_status = ?, supplier_payment_status = ?, shipment_status = ? WHERE id = ?").run(
      dbStatus, dbStatus, shipStatus, inv.id
    );
    updated++;
    console.log(`  Fixed ${invoiceNumber}: ${inv.customer_payment_status} → ${dbStatus}`);
  } else {
    alreadyCorrect++;
  }
}

console.log(`\nDone! Fixed: ${updated}, Already correct: ${alreadyCorrect}`);

// Verify final counts
const unpaid = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE customer_payment_status = 'unpaid'").get() as { c: number };
const paid = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE customer_payment_status = 'paid'").get() as { c: number };
console.log(`Final: ${paid.c} paid, ${unpaid.c} unpaid`);

// Show which ones are unpaid
const unpaidList = db.prepare(`
  SELECT i.invoice_number, po.po_number, c.name as client
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN clients c ON po.client_id = c.id
  WHERE i.customer_payment_status = 'unpaid'
  ORDER BY po.po_number
`).all() as { invoice_number: string; po_number: string; client: string }[];

console.log(`\nUnpaid invoices (${unpaidList.length}):`);
for (const inv of unpaidList) {
  console.log(`  ${inv.invoice_number} (${inv.po_number}) - ${inv.client}`);
}
