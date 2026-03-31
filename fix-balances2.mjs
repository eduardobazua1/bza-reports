import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// Clean all supplier payments
await db.execute(`DELETE FROM supplier_payments`);
console.log("✅ Cleaned all supplier_payments");

const suppliers = await db.execute(`SELECT id, name FROM suppliers`);
const supp = {};
for (const r of suppliers.rows) supp[r[1]] = Number(r[0]);
const now = new Date().toISOString();

// Insert TOTAL PAID per supplier from X0022+ (from your Excel "pagos realizados a proveedores")
const cppId = supp['Cascade Pacific Pulp (CPP)'];
const araucoId = supp['Arauco'];
const appId = supp['APP China Trading Limited'];

await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, adjustment_status, notes, created_at) VALUES (?, 4326001.00, '2026-03-20', 'settled', 'Total pagos realizados a CPP desde X0022 (Sales Report)', ?)`, args: [cppId, now] });
await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, adjustment_status, notes, created_at) VALUES (?, 8589229.00, '2026-03-20', 'settled', 'Total pagos realizados a Arauco desde X0022 (Sales Report)', ?)`, args: [araucoId, now] });
await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, adjustment_status, notes, created_at) VALUES (?, 27200.00, '2026-03-20', 'settled', 'Total pagado APP (saldado)', ?)`, args: [appId, now] });
console.log("✅ Payments inserted");

// Verify: Total real cost from X0022 to X0042 (excluding X0043 - not yet in Excel)
const costs = await db.execute(`
  SELECT s.name,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0)) as total_real
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id
  WHERE po.po_number >= 'X0022' AND po.po_number < 'X0043'
  GROUP BY s.name
`);

const payments = await db.execute(`SELECT supplier_id, SUM(amount_usd) as total FROM supplier_payments GROUP BY supplier_id`);
const paidMap = {};
for (const r of payments.rows) paidMap[Number(r[0])] = Number(r[1]);

console.log('\n=== Balance (X0022 - X0042) ===');
for (const r of costs.rows) {
  const real = Number(r[1]);
  const suppEntry = Object.entries(supp).find(([k]) => r[0] === k);
  const paid = suppEntry ? (paidMap[suppEntry[1]] || 0) : 0;
  const balance = real - paid;
  const status = balance > 0 ? `Debes $${balance.toLocaleString('en',{maximumFractionDigits:2})}` : `Te deben $${Math.abs(balance).toLocaleString('en',{maximumFractionDigits:2})}`;
  console.log(`${r[0]}:`);
  console.log(`  Total real: $${real.toLocaleString('en',{maximumFractionDigits:2})}`);
  console.log(`  Total pagado: $${paid.toLocaleString('en',{maximumFractionDigits:2})}`);
  console.log(`  Balance: ${status}`);
}

// X0043 separate
const x43 = await db.execute(`
  SELECT SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)) as cost
  FROM invoices i JOIN purchase_orders po ON i.purchase_order_id = po.id
  WHERE po.po_number = 'X0043'
`);
console.log(`\nX0043 (pendiente embarque): $${Number(x43.rows[0][0] || 0).toLocaleString('en',{maximumFractionDigits:2})} → aún no pagado`);
