import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// Update CPP total paid to include X0043 payment of $297,000
// Total CPP paid = $4,326,001 (X0022-X0042) + $297,000 (X0043) = $4,623,001
await db.execute(`UPDATE supplier_payments SET amount_usd = 4623001.00, notes = 'Total pagos CPP: X0022-X0042 ($4,326,001) + X0043 ($297,000 pagado 20/mar/2026)' WHERE notes LIKE '%CPP%'`);
console.log("✅ CPP total updated to $4,623,001");

// Check final balances including X0043
const r = await db.execute(`
  SELECT s.name,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0)) as total_real,
    COALESCE((SELECT SUM(sp.amount_usd) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) as total_paid
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id
  WHERE po.po_number >= 'X0022'
  GROUP BY s.name
`);

console.log('\n=== Balance Final (X0022+) ===');
for (const row of r.rows) {
  const real = Number(row[1]);
  const paid = Number(row[2]);
  const balance = real - paid;
  const status = balance > 0 ? `Debes $${balance.toFixed(2)}` : `Te deben $${Math.abs(balance).toFixed(2)}`;
  console.log(`${row[0]}: Real=$${real.toFixed(2)} | Pagado=$${paid.toFixed(2)} | ${status}`);
}
