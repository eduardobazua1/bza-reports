import Database from "better-sqlite3";
import path from "path";
const db = new Database(path.join(process.cwd(), "sqlite.db"));

interface Row { [key: string]: unknown }

const totals = db.prepare(`
  SELECT COUNT(*) as invoices, ROUND(SUM(i.quantity_tons)) as tons,
    ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price))) as revenue,
    ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price))) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
`).get() as Row;
const profit = (totals.revenue as number) - (totals.cost as number);
const margin = ((profit / (totals.revenue as number)) * 100).toFixed(1);
console.log("=== TOTALS ===");
console.log(`Invoices: ${totals.invoices}, Tons: ${totals.tons}`);
console.log(`Revenue: $${(totals.revenue as number).toLocaleString()}, Cost: $${(totals.cost as number).toLocaleString()}`);
console.log(`Profit: $${profit.toLocaleString()}, Margin: ${margin}%`);

console.log("\n=== BY YEAR ===");
const byYear = db.prepare(`
  SELECT SUBSTR(COALESCE(i.shipment_date, po.po_date), 1, 4) as year,
    ROUND(SUM(i.quantity_tons)) as tons,
    ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price))) as revenue,
    ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price))) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  GROUP BY year ORDER BY year
`).all() as Row[];
for (const y of byYear) {
  const p = (y.revenue as number) - (y.cost as number);
  const m = (y.revenue as number) > 0 ? (p / (y.revenue as number) * 100).toFixed(1) : "0";
  console.log(`${y.year || 'N/A'}: ${y.tons} TN, Rev $${(y.revenue as number).toLocaleString()}, Cost $${(y.cost as number).toLocaleString()}, Profit $${p.toLocaleString()}, Margin ${m}%`);
}

console.log("\n=== BY CLIENT ===");
const byClient = db.prepare(`
  SELECT c.name, COUNT(i.id) as invs, ROUND(SUM(i.quantity_tons)) as tons,
    ROUND(SUM(i.quantity_tons * COALESCE(i.sell_price_override, po.sell_price))) as revenue,
    ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price))) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN clients c ON po.client_id = c.id GROUP BY c.name ORDER BY revenue DESC
`).all() as Row[];
for (const c of byClient) {
  const p = (c.revenue as number) - (c.cost as number);
  const m = (c.revenue as number) > 0 ? (p / (c.revenue as number) * 100).toFixed(1) : "0";
  console.log(`${c.name}: ${c.invs} inv, ${c.tons} TN, Rev $${(c.revenue as number).toLocaleString()}, Cost $${(c.cost as number).toLocaleString()}, Profit $${p.toLocaleString()}, Margin ${m}%`);
}

console.log("\n=== INVOICES WITHOUT DATE (showing as N/A) ===");
const noDate = db.prepare(`
  SELECT COUNT(*) as c, ROUND(SUM(i.quantity_tons)) as tons
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  WHERE i.shipment_date IS NULL AND po.po_date IS NULL
`).get() as Row;
console.log(`${noDate.c} invoices without date (${noDate.tons} TN) — these show as N/A in charts`);

console.log("\n=== PO STATUS ===");
const pos = db.prepare("SELECT status, COUNT(*) as c FROM purchase_orders GROUP BY status").all() as Row[];
pos.forEach(p => console.log(`${p.status}: ${p.c}`));

console.log("\n=== SUPPLIER PAYMENTS ===");
const payments = db.prepare(`
  SELECT s.name, ROUND(SUM(sp.amount_usd)) as paid
  FROM supplier_payments sp JOIN suppliers s ON sp.supplier_id = s.id GROUP BY s.name
`).all() as Row[];
payments.forEach(p => console.log(`${p.name}: $${(p.paid as number).toLocaleString()} paid`));

console.log("\n=== SUPPLIER BALANCE ===");
const costs = db.prepare(`
  SELECT s.name, ROUND(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price))) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id GROUP BY s.name
`).all() as Row[];
for (const c of costs) {
  const paid = payments.find(p => p.name === c.name);
  const balance = (c.cost as number) - ((paid?.paid as number) || 0);
  console.log(`${c.name}: Cost $${(c.cost as number).toLocaleString()}, Paid $${((paid?.paid as number) || 0).toLocaleString()}, Balance $${balance.toLocaleString()}`);
}
