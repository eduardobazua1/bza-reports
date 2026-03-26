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

let updated = 0;
for (let i = 6; i < data.length; i++) {
  const row = data[i];
  if (!row) continue;
  const inv = row[3] as string;
  const cust = row[6] as string;
  if (!inv || cust === "TOTAL") continue;

  // Column C = per-invoice date (this is the shipment date)
  const dateFromColC = serialToDate(row[2]);
  if (!dateFromColC) continue;

  const dbInv = db.prepare("SELECT id, shipment_date FROM invoices WHERE invoice_number = ?").get(inv) as { id: number; shipment_date: string | null } | undefined;
  if (!dbInv) continue;

  if (dbInv.shipment_date !== dateFromColC) {
    db.prepare("UPDATE invoices SET shipment_date = ? WHERE id = ?").run(dateFromColC, dbInv.id);
    updated++;
    if (dbInv.shipment_date) {
      console.log(`  ${inv}: ${dbInv.shipment_date} → ${dateFromColC}`);
    } else {
      console.log(`  ${inv}: null → ${dateFromColC}`);
    }
  }
}

console.log(`\nUpdated ${updated} dates`);

// Verify annual totals
const byYear = db.prepare(`
  SELECT SUBSTR(i.shipment_date, 1, 4) as year,
    SUM(i.quantity_tons) as tons,
    SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price)) as revenue,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  GROUP BY year ORDER BY year
`).all() as { year: string; tons: number; revenue: number; cost: number }[];

console.log("\nCorrected annual totals:");
for (const y of byYear) {
  const p = y.revenue - y.cost;
  console.log(`${y.year}: Tons=${y.tons.toFixed(3)} Revenue=$${y.revenue.toFixed(2)} Cost=$${y.cost.toFixed(2)} Profit=$${p.toFixed(2)} Margin=${(p/y.revenue*100).toFixed(2)}%`);
}
