import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// Exact query from dashboard
const costs = await db.execute(`
  SELECT s.id, s.name,
    COALESCE(SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0)), 0) as total_real
  FROM invoices i
  LEFT JOIN purchase_orders po ON i.purchase_order_id = po.id
  LEFT JOIN suppliers s ON po.supplier_id = s.id
  WHERE po.po_number >= 'X0022'
  GROUP BY s.id, s.name
`);
console.log("Costs from X0022+:", costs.rows.map(r => `${r[1]}: $${Number(r[2]).toFixed(2)}`));

const payments = await db.execute(`SELECT supplier_id, SUM(amount_usd) as total FROM supplier_payments GROUP BY supplier_id`);
console.log("Payments:", payments.rows.map(r => `supplierId=${r[0]}: $${Number(r[1]).toFixed(2)}`));

console.log("\n=== Final Balance ===");
for (const c of costs.rows) {
  const p = payments.rows.find(r => r[0] == c[0]);
  const real = Number(c[2]);
  const paid = p ? Number(p[1]) : 0;
  const balance = real - paid;
  console.log(`${c[1]}: real=$${real.toFixed(2)} paid=$${paid.toFixed(2)} balance=${balance >= 0 ? 'OWES' : 'OWED'} $${Math.abs(balance).toFixed(2)}`);
}
