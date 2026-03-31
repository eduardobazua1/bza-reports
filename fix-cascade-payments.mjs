import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const cascade = await db.execute(`SELECT id FROM suppliers WHERE name LIKE '%Cascade%'`);
const supplierId = cascade.rows[0][0];

// 1. Mark ALL Cascade POs before X0024 as paid
const beforeX0024 = await db.execute({
  sql: `SELECT id, po_number FROM purchase_orders WHERE supplier_id = ? AND po_number < 'X0024'`,
  args: [supplierId]
});
console.log("POs before X0024:", beforeX0024.rows.map(r => r[1]));
for (const row of beforeX0024.rows) {
  const r = await db.execute({ sql: `UPDATE invoices SET supplier_payment_status = 'paid' WHERE purchase_order_id = ?`, args: [row[0]] });
  if (r.rowsAffected > 0) console.log(`✅ ${row[1]}: ${r.rowsAffected} invoices → paid`);
}

// 2. Revert X0040, X0041, X0042 back to unpaid (my mistake earlier)
const revert = await db.execute({
  sql: `SELECT id, po_number FROM purchase_orders WHERE supplier_id = ? AND po_number IN ('X0040', 'X0041', 'X0042')`,
  args: [supplierId]
});
for (const row of revert.rows) {
  const r = await db.execute({ sql: `UPDATE invoices SET supplier_payment_status = 'unpaid' WHERE purchase_order_id = ?`, args: [row[0]] });
  console.log(`↩️ ${row[1]}: ${r.rowsAffected} invoices → unpaid (pending bank records)`);
}

console.log("Done");
