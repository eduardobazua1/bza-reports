import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

const client = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const SUPPLIER_ID = 1; // Cascade Pacific Pulp
const DIR = "/private/tmp/bza-invoices";

const INVOICES = [
  // PO X0007 (po_id=6)
  { hs:"HS100728", date:"2023-04-03", tons:89.334, amount:55833.75, bza_id:17, po_id:6 },
  { hs:"HS100729", date:"2023-04-03", tons:89.987, amount:56241.88, bza_id:18, po_id:6 },
  { hs:"HS100730", date:"2023-04-03", tons:91.285, amount:57053.13, bza_id:19, po_id:6 },
  { hs:"HS100731", date:"2023-04-04", tons:91.42,  amount:57137.50, bza_id:20, po_id:6 },
  { hs:"HS100732", date:"2023-04-04", tons:91.836, amount:57397.50, bza_id:21, po_id:6 },
  { hs:"HS100733", date:"2023-04-04", tons:89.624, amount:56015.00, bza_id:22, po_id:6 },
  { hs:"HS100734", date:"2023-04-04", tons:89.374, amount:55858.75, bza_id:23, po_id:6 },
  { hs:"HS100741", date:"2023-04-05", tons:89.886, amount:56178.75, bza_id:24, po_id:6 },
  // PO X0008 (po_id=7)
  { hs:"HS100825", date:"2023-04-17", tons:90.92,  amount:56825.00, bza_id:25, po_id:7 },
  // PO X0009 (po_id=8)
  { hs:"HS101012", date:"2023-05-22", tons:91.027, amount:51430.26, bza_id:26, po_id:8 },
  { hs:"HS101013", date:"2023-05-22", tons:90.071, amount:50890.12, bza_id:27, po_id:8 },
  { hs:"HS101014", date:"2023-05-22", tons:90.448, amount:51103.12, bza_id:28, po_id:8 },
  { hs:"HS101015", date:"2023-05-22", tons:91.344, amount:51609.36, bza_id:29, po_id:8 },
  { hs:"HS101016", date:"2023-05-22", tons:89.852, amount:50766.38, bza_id:30, po_id:8 },
  { hs:"HS101017", date:"2023-05-22", tons:90.551, amount:51161.32, bza_id:31, po_id:8 },
  { hs:"HS101018", date:"2023-05-22", tons:90.82,  amount:51313.30, bza_id:32, po_id:8 },
  // PO X0010 (po_id=9)
  { hs:"HS101334", date:"2023-07-03", tons:88.946, amount:48475.57, bza_id:33, po_id:9 },
  { hs:"HS101335", date:"2023-07-03", tons:88.762, amount:48375.29, bza_id:34, po_id:9 },
  { hs:"HS101396", date:"2023-07-24", tons:89.415, amount:48731.18, bza_id:35, po_id:9 },
  { hs:"HS101397", date:"2023-07-24", tons:91.117, amount:49658.77, bza_id:36, po_id:9 },
  { hs:"HS101398", date:"2023-07-24", tons:89.099, amount:48558.96, bza_id:37, po_id:9 },
  { hs:"HS101399", date:"2023-07-24", tons:89.477, amount:48764.97, bza_id:38, po_id:9 },
];

// Check which ones already exist
const existing = await client.execute("SELECT invoice_number FROM supplier_invoices");
const existingNums = new Set(existing.rows.map(r => String(r.invoice_number)));

let inserted = 0, skipped = 0, updated = 0;

for (const inv of INVOICES) {
  const filePath = path.join(DIR, `${inv.hs}.pdf`);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  PDF not found: ${inv.hs}.pdf`);
    continue;
  }

  const pdfBuf = fs.readFileSync(filePath);
  const fileSize = pdfBuf.length;
  const fileUrl = `data:application/pdf;base64,${pdfBuf.toString("base64")}`;
  const fileName = `${inv.hs}.pdf`;

  if (existingNums.has(inv.hs)) {
    console.log(`⏭  ${inv.hs} already exists — skipping`);
    skipped++;
    continue;
  }

  // Insert into supplier_invoices
  await client.execute({
    sql: `INSERT INTO supplier_invoices 
          (purchase_order_id, supplier_id, invoice_number, invoice_date, estimated_tons, amount_usd,
           file_name, file_url, file_size, payment_status, linked_invoice_id, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,'unpaid',?,CURRENT_TIMESTAMP)`,
    args: [inv.po_id, SUPPLIER_ID, inv.hs, inv.date, inv.tons, inv.amount,
           fileName, fileUrl, fileSize, inv.bza_id]
  });

  // Update supplier_invoice_number on the BZA invoice
  await client.execute({
    sql: "UPDATE invoices SET supplier_invoice_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [inv.hs, inv.bza_id]
  });

  console.log(`✅ ${inv.hs} → BZA id=${inv.bza_id} | ${inv.tons}t | $${inv.amount}`);
  inserted++;
}

console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${INVOICES.length - inserted - skipped} errors`);
client.close();
