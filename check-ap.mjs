import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// AP por proveedor
const r = await db.execute(`
  SELECT s.name, 
    SUM(CASE WHEN i.supplier_payment_status = 'unpaid' THEN i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0) ELSE 0 END) as ap,
    SUM(CASE WHEN i.supplier_payment_status = 'paid' THEN i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) + COALESCE(i.freight_cost,0) ELSE 0 END) as paid,
    COUNT(*) as invoices,
    SUM(CASE WHEN i.supplier_payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id
  GROUP BY s.name
`);

console.log('\n=== AP por Proveedor ===');
let totalAP = 0;
for (const row of r.rows) {
  console.log(`${row[0]}: AP = $${Number(row[1]).toLocaleString()} (${row[4]} facturas) | Pagado histórico: $${Number(row[2]).toLocaleString()}`);
  totalAP += Number(row[1]);
}
console.log(`\nTOTAL AP: $${totalAP.toLocaleString()}`);

// POs pendientes de pago
const pos = await db.execute(`
  SELECT po.po_number, s.name as supplier,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)) as cost,
    SUM(CASE WHEN i.supplier_payment_status = 'unpaid' THEN i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price) ELSE 0 END) as pending,
    SUM(CASE WHEN i.supplier_payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
    SUM(CASE WHEN i.supplier_payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count
  FROM invoices i
  JOIN purchase_orders po ON i.purchase_order_id = po.id
  JOIN suppliers s ON po.supplier_id = s.id
  GROUP BY po.po_number, s.name
  HAVING pending > 0
  ORDER BY po.po_number
`);
console.log('\n=== POs con Saldo Pendiente ===');
for (const row of pos.rows) {
  console.log(`${row[0]} (${row[1]}): Pendiente = $${Number(row[3]).toLocaleString()} | Facturas sin pagar: ${row[5]}`);
}
