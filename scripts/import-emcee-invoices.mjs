import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";

const client = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const SUPPLIER_ID = 1; // Cascade Pacific Pulp
const DIR = "/private/tmp/bza-emcee";

const PO_ID = { X0037:33, X0038:34, X0039:35, X0040:36, X0041:37, X0042:38, X0043:40 };

// BZA invoice mapping: tons → id (per PO)
const BZA = {
  X0037: { 93.172:148, 90.868:147, 93.622:149 },
  X0038: {},
  X0039: { 92.511:159, 93.306:158, 89.723:157, 89.551:160, 89.985:163, 86.611:162, 90.239:161 },
  X0040: { 92.417:165, 94.604:166, 92.742:167, 91.683:168, 91.53:169 },
  X0041: { 90.772:175, 90.45:174, 90.197:173, 89.118:172, 94.114:171, 91.822:170 },
  X0042: { 90.292:176, 92.272:177, 90.068:178 },
  X0043: { 90.648:195, 93.665:196 }
};

// PDF file mapping for each invoice number
const PDF_FILE = {
  "3001153-1114": "Invoice 3001153-1114.pdf",
  "3001154-1114": "Invoice 3001154-1114.pdf",
  "3001239-1117": "Invoice 3001239-1117.pdf",
  "3001381-1124": "Invoice 3001381-1124.pdf",
  "3001760-1219": "Invoice 3001760-1219.pdf",
  "3001761-1219": "Invoice 3001761-1219.pdf",
  "3001762-1219": "Invoice 3001762-1219.pdf",
  "3001763-1222": "Invoice 3001763-1222.pdf",
  "3001848-1222": "Invoice 3001848-1222 corrected admt.pdf",
  "3001849-1222": "Invoice 3001849-1222.pdf",
  "3001850-1222": "Invoice 3001850-1222.pdf",
  "4000057-0130": "Invoice 4000057-0130.pdf",
  "4000058-0130": "Invoice 4000058-0130.pdf",
  "4000059-0130": "Invoice 4000059-0130.pdf",
  "4000060-0130": "Invoice 4000060-0130.pdf",
  "4000061-0130": "Invoice 4000061-0130.pdf",
  "4000529-0223": "Invoice 4000529-0223.pdf",
  "4000530-0223": "Invoice 4000530-0223.pdf",
  "4000531-0223": "Invoice 4000531-0223.pdf",
  "4000532-0223": "Invoice 4000532-0223.pdf",
  "4000533-0223": "Invoice 4000533-0223.pdf",
  "4000534-0223": "Invoice 4000534-0223.pdf",
  "4000850-0316": "Invoice 4000850-0316.pdf",
  "4000851-0316": "Invoice 4000851-0316.pdf",
  "4000852-0316": "Invoice 4000852-0316.pdf",
  "4000853-0316": "Invoice 4000853-0316.pdf",
  "4000854-0318": "Invoice 4000854-0318.pdf",
  "4001055-0323": "Invoice 4001055-0323.pdf",
  "4001056-0323": "Invoice 4001056-0323.pdf",
  "4001057-0323": "Invoice 4001057-0323.pdf",
  "4001058-0323": "Invoice 4001058-0323.pdf",
  "4001123-0330": "Invoice 4001123-0330.pdf",
  "4001124-0330": "Invoice 4001124-0330.pdf",
  "500184": "Invoice 500184.pdf",
  "500287": "Invoice 500287.pdf"
};

// Load parsed.json and deduplicate
const all = JSON.parse(readFileSync(`${DIR}/parsed.json`, "utf8"));

// Deduplicate: remove duplicate 3001763, keep lower amount for 3001848
const seen = new Set();
const invoices = [];
for (const inv of all) {
  const key = inv.invNum;
  if (key === "3001848-1222") {
    // Keep corrected version (lower amount = $48357.77)
    if (!seen.has(key)) {
      seen.add(key);
      invoices.push({ ...inv, amount: 48357.77 });
    }
    continue;
  }
  if (seen.has(key)) continue;
  seen.add(key);
  invoices.push(inv);
}

console.log(`\n📦 Inserting ${invoices.length} Emcee supplier invoices...\n`);

let inserted = 0, matched = 0, errors = 0;

for (const inv of invoices) {
  const poId = PO_ID[inv.po];
  const bzaMap = BZA[inv.po] || {};
  const linkedId = bzaMap[inv.tons] || null;

  const fileName = PDF_FILE[inv.invNum];
  let fileUrl = null, fileSize = 0;

  if (fileName) {
    const filePath = `${DIR}/${fileName}`;
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      fileSize = buf.length;
      fileUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
    }
  }

  try {
    await client.execute({
      sql: `INSERT INTO supplier_invoices 
            (purchase_order_id, supplier_id, invoice_number, invoice_date, estimated_tons, amount_usd,
             file_name, file_url, file_size, payment_status, linked_invoice_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,'paid',?,CURRENT_TIMESTAMP)`,
      args: [poId, SUPPLIER_ID, inv.invNum, inv.invDate, inv.tons, inv.amount,
             fileName || `${inv.invNum}.pdf`, fileUrl, fileSize, linkedId]
    });

    if (linkedId) {
      await client.execute({
        sql: "UPDATE invoices SET supplier_invoice_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [inv.invNum, linkedId]
      });
      matched++;
    }

    const mark = linkedId ? "✅" : "⚠️ ";
    const bzaLabel = linkedId ? ` → BZA id=${linkedId}` : " → NO MATCH";
    console.log(`${mark} ${inv.invNum.padEnd(20)} ${inv.po} ${inv.tons}t${bzaLabel}`);
    inserted++;
  } catch (e) {
    console.log(`❌ ${inv.invNum}: ${e.message}`);
    errors++;
  }
}

console.log(`\n✅ Inserted: ${inserted} | Matched to BZA: ${matched} | Errors: ${errors}`);
client.close();
