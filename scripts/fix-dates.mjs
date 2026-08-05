import { createClient } from "@libsql/client";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const client = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

async function pdfToText(buffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function parseDate(str) {
  if (!str) return null;
  // D-MMM-YYYY  e.g. "3-Apr-2023", "30-Apr-2022"
  let m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  }
  // M/DD/YYYY or MM/DD/YYYY  e.g. "3/16/2026", "04/14/2026"
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${String(m[1]).padStart(2,"0")}-${String(m[2]).padStart(2,"0")}`;
  return null;
}

function extractShipDate(text) {
  // Format 1: BNSF BOL — "D-MMM-YYYY Ship Date" or "Ship Date D-MMM-YYYY"
  let m = text.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})\s+Ship\s+Date/i);
  if (m) return { date: parseDate(m[1]), source: `"${m[1]} Ship Date"` };
  m = text.match(/Ship\s+Date\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i);
  if (m) return { date: parseDate(m[1]), source: `"Ship Date ${m[1]}"` };

  // Format 2: Cascade newer — "SHIP DATE  M/DD/YYYY"
  m = text.match(/SHIP\s+DATE\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (m) return { date: parseDate(m[1]), source: `"SHIP DATE ${m[1]}"` };

  // Format 3: BNSF Delivery Note — date next to "BNSF Railway Company"
  m = text.match(/BNSF\s+Railway\s+Company\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (m) return { date: parseDate(m[1]), source: `"BNSF Railway Company ${m[1]}"` };

  // Format 4: Single standalone M/DD/YYYY date (X0041, X0042 without label)
  const allDates = [...text.matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g)].map(x => x[1]);
  const unique = [...new Set(allDates)];
  if (unique.length === 1) return { date: parseDate(unique[0]), source: `only date: "${unique[0]}"` };
  if (unique.length > 1) {
    // multiple dates — pick first (instruction date for delivery notes)
    return { date: parseDate(unique[0]), source: `first of [${unique.join(", ")}]` };
  }

  return null;
}

const rows = await client.execute({
  sql: `SELECT i.invoice_number, i.shipment_date, i.invoice_date, d.file_url 
        FROM documents d 
        JOIN invoices i ON d.invoice_id = i.id 
        WHERE d.type = 'bl' 
        ORDER BY i.invoice_number`,
  args: []
});

const updates = [];
const nodate = [];

for (const row of rows.rows) {
  const invoice = String(row.invoice_number);
  const b64 = String(row.file_url).replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  const text = await pdfToText(buf);
  const result = extractShipDate(text);
  const currentShipDate = row.shipment_date ? String(row.shipment_date) : "NULL";
  const currentInvDate = row.invoice_date ? String(row.invoice_date) : "NULL";

  if (result?.date) {
    const changed = currentShipDate !== result.date || currentInvDate !== result.date;
    updates.push({ invoice, newDate: result.date, source: result.source, currentShipDate, currentInvDate, changed });
  } else {
    nodate.push({ invoice, currentShipDate, currentInvDate });
  }
}

const pad = (s, n) => String(s).padEnd(n);

console.log("\n📋 PLAN — Dates to update:");
console.log("=".repeat(80));
console.log(pad("Invoice",16) + pad("Current Ship",14) + pad("New Date",14) + "Source");
console.log("-".repeat(80));
for (const u of updates) {
  const mark = u.changed ? "→" : "✓";
  console.log(mark + " " + pad(u.invoice,15) + pad(u.currentShipDate,14) + pad(u.newDate,14) + u.source);
}

if (nodate.length) {
  console.log(`\n⚠️  No date found in BOL (${nodate.length}):`);
  for (const n of nodate) console.log(`   ${n.invoice} (current: ${n.currentShipDate})`);
}

const toUpdate = updates.filter(u => u.changed);
console.log(`\n${toUpdate.length} invoices need updating, ${updates.filter(u=>!u.changed).length} already correct, ${nodate.length} need manual date.`);

client.close();
