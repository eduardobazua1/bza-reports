import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import path from "path";

const db = new Database(path.join(process.cwd(), "sqlite.db"));
const filePath = path.resolve(process.env.HOME || "", "Library/Mobile Documents/com~apple~CloudDocs/PEFC : BZA/PEFC 2025/Sales Aging Report..2025.xlsx");

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets["Hoja1 (2)"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];

function serialToDate(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000).toISOString().split("T")[0];
}

let fixed = 0;
for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row) continue;

  const inv = row[3] as string;
  const poDateRaw = row[2]; // Column C
  const shipDateRaw = row[27]; // Column AB

  if (!inv) continue;

  // Use shipment date if available, otherwise PO date
  let dateToUse: string | null = null;
  if (shipDateRaw && typeof shipDateRaw === "number") {
    dateToUse = serialToDate(shipDateRaw);
  } else if (shipDateRaw && typeof shipDateRaw === "string" && shipDateRaw !== "pending") {
    const d = new Date(shipDateRaw);
    if (!isNaN(d.getTime())) dateToUse = d.toISOString().split("T")[0];
  }

  if (!dateToUse && poDateRaw && typeof poDateRaw === "number") {
    dateToUse = serialToDate(poDateRaw);
  } else if (!dateToUse && poDateRaw && typeof poDateRaw === "string" && poDateRaw !== "pending") {
    const d = new Date(poDateRaw);
    if (!isNaN(d.getTime())) dateToUse = d.toISOString().split("T")[0];
  }

  if (!dateToUse) continue;

  // Check if invoice has no date in DB
  const dbInv = db.prepare("SELECT id, shipment_date FROM invoices WHERE invoice_number = ?").get(inv) as { id: number; shipment_date: string | null } | undefined;
  if (dbInv && !dbInv.shipment_date) {
    db.prepare("UPDATE invoices SET shipment_date = ? WHERE id = ?").run(dateToUse, dbInv.id);
    fixed++;
    console.log(`  ${inv}: set date to ${dateToUse}`);
  }
}

console.log(`\nFixed ${fixed} invoice dates`);

// Verify
const noDate = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE shipment_date IS NULL").get() as { c: number };
console.log(`Remaining without date: ${noDate.c}`);
