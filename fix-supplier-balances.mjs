import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// 1. Mark ALL invoices before X0022 as paid (for all suppliers)
const oldPOs = await db.execute(`SELECT id FROM purchase_orders WHERE po_number < 'X0022'`);
for (const row of oldPOs.rows) {
  await db.execute({ sql: `UPDATE invoices SET supplier_payment_status = 'paid' WHERE purchase_order_id = ?`, args: [row[0]] });
}
console.log(`✅ All POs before X0022 marked as paid`);

// 2. Get supplier IDs
const suppliers = await db.execute(`SELECT id, name FROM suppliers`);
const supp = {};
for (const r of suppliers.rows) supp[r[1]] = r[0];
console.log('Suppliers:', Object.keys(supp));

// 3. Delete old supplier_payment records from X0022+ (clean slate)
const posX22plus = await db.execute(`SELECT id FROM purchase_orders WHERE po_number >= 'X0022'`);
const poIds = posX22plus.rows.map(r => r[0]);
if (poIds.length > 0) {
  await db.execute({ sql: `DELETE FROM supplier_payments WHERE purchase_order_id IN (${poIds.map(() => '?').join(',')})`, args: poIds });
  console.log(`✅ Cleared old payment records for X0022+`);
}

// 4. Add correct payment records from Excel data
const now = new Date().toISOString();

// CPP: total paid $4,326,001 from X0022 onwards
const cppId = Object.entries(supp).find(([k]) => k.includes('Cascade'))?.[1];
if (cppId) {
  await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, notes, created_at) VALUES (?, 4326001.00, '2026-03-20', 'Total pagado CPP desde X0022 (según Sales Report)', ?)`, args: [cppId, now] });
  console.log(`✅ CPP: $4,326,001 registrado`);
}

// Arauco: total paid $8,589,229 from X0022 onwards
const araucoId = Object.entries(supp).find(([k]) => k.includes('Arauco'))?.[1];
if (araucoId) {
  await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, notes, created_at) VALUES (?, 8589229.00, '2026-03-20', 'Total pagado Arauco desde X0022 (según Sales Report)', ?)`, args: [araucoId, now] });
  console.log(`✅ Arauco: $8,589,229 registrado`);
}

// APP: total paid $27,200
const appId = Object.entries(supp).find(([k]) => k.includes('APP') || k.includes('China'))?.[1];
if (appId) {
  await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, amount_usd, payment_date, notes, created_at) VALUES (?, 27200.00, '2026-03-20', 'Total pagado APP (saldado)', ?)`, args: [appId, now] });
  console.log(`✅ APP: $27,200 registrado`);
}

// 5. Verify final balance
const check = await db.execute(`
  SELECT s.name,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0)) as total_real,
    COALESCE((SELECT SUM(sp.amount_usd) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as total_paid
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id
  WHERE po.po_number >= 'X0022'
  GROUP BY s.name
`);

console.log('\n=== Balance desde X0022 ===');
for (const r of check.rows) {
  const real = Number(r[1]);
  const paid = Number(r[2]);
  const balance = real - paid;
  console.log(`${r[0]}: Real=$${real.toLocaleString()} | Pagado=$${paid.toLocaleString()} | Balance=${balance >= 0 ? '-' : '+'}$${Math.abs(balance).toLocaleString()}`);
}
