import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import path from "path";

const db = new Database(path.join(process.cwd(), "sqlite.db"));
const filePath = path.resolve(process.env.HOME || "", "Library/Mobile Documents/com~apple~CloudDocs/PEFC : BZA/PEFC 2025/Sales Aging Report..2025.xlsx");

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets["Hoja1 (2)"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];

function serialToDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "number") return new Date((val - 25569) * 86400000).toISOString().split("T")[0];
  if (typeof val === "string" && val !== "pending") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
  }
  return null;
}

// Build Excel data by year
const excelByYear: Record<string, { tons: number; revenue: number; cost: number; invoices: string[] }> = {};

for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row) continue;
  const po = row[1] as string;
  const inv = row[3] as string;
  const cust = row[6] as string;
  const qty = row[12] as number;
  const sell = row[16] as number;
  const buy = row[18] as number;
  const dateRaw = row[2]; // Column C = per-invoice date

  if (!po || !inv || cust === "TOTAL" || !qty || typeof qty !== "number" || qty <= 0) continue;
  if (po === "no se realizo") continue;

  const date = serialToDate(dateRaw);
  const year = date ? date.substring(0, 4) : "N/A";

  if (!excelByYear[year]) excelByYear[year] = { tons: 0, revenue: 0, cost: 0, invoices: [] };
  excelByYear[year].tons += qty;
  excelByYear[year].revenue += qty * (sell || 0);
  excelByYear[year].cost += qty * (buy || 0);
  excelByYear[year].invoices.push(inv);
}

console.log("=== EXCEL BY YEAR ===");
for (const [year, d] of Object.entries(excelByYear).sort()) {
  console.log(`${year}: Tons=${d.tons.toFixed(3)} Revenue=$${d.revenue.toFixed(2)} Cost=$${d.cost.toFixed(2)} Profit=$${(d.revenue - d.cost).toFixed(2)} (${d.invoices.length} inv)`);
}

// DB by year
console.log("\n=== DB BY YEAR ===");
const dbByYear = db.prepare(`
  SELECT SUBSTR(i.shipment_date, 1, 4) as year,
    SUM(i.quantity_tons) as tons,
    SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)) as revenue,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)) as cost,
    COUNT(*) as cnt
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  GROUP BY year ORDER BY year
`).all() as { year: string; tons: number; revenue: number; cost: number; cnt: number }[];

for (const y of dbByYear) {
  console.log(`${y.year}: Tons=${y.tons.toFixed(3)} Revenue=$${y.revenue.toFixed(2)} Cost=$${y.cost.toFixed(2)} Profit=$${(y.revenue - y.cost).toFixed(2)} (${y.cnt} inv)`);
}

// Compare
console.log("\n=== DIFFERENCES ===");
const allYears = new Set([...Object.keys(excelByYear), ...dbByYear.map(y => y.year)]);
for (const year of [...allYears].sort()) {
  const ex = excelByYear[year];
  const db2 = dbByYear.find(y => y.year === year);
  if (!ex && db2) { console.log(`${year}: IN DB BUT NOT EXCEL (${db2.cnt} inv)`); continue; }
  if (ex && !db2) { console.log(`${year}: IN EXCEL BUT NOT DB (${ex.invoices.length} inv)`); continue; }
  if (ex && db2) {
    const tonsDiff = Math.abs(ex.tons - db2.tons);
    const revDiff = Math.abs(ex.revenue - db2.revenue);
    if (tonsDiff > 1 || revDiff > 100) {
      console.log(`${year}: MISMATCH! Excel: ${ex.tons.toFixed(1)} TN / $${ex.revenue.toFixed(0)} | DB: ${db2.tons.toFixed(1)} TN / $${db2.revenue.toFixed(0)} | Diff: ${(ex.tons - db2.tons).toFixed(1)} TN / $${(ex.revenue - db2.revenue).toFixed(0)}`);
    } else {
      console.log(`${year}: ✓ MATCH`);
    }
  }
}

// Check for invoices in Excel not in DB
console.log("\n=== MISSING FROM DB ===");
const dbInvs = new Set((db.prepare("SELECT invoice_number FROM invoices").all() as { invoice_number: string }[]).map(r => r.invoice_number));
for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row) continue;
  const inv = row[3] as string;
  const cust = row[6] as string;
  const qty = row[12] as number;
  if (!inv || cust === "TOTAL" || !qty) continue;
  if (!dbInvs.has(inv)) {
    console.log(`  ${inv} (PO ${row[1]}) - ${qty} TN - NOT IN DB`);
  }
}
