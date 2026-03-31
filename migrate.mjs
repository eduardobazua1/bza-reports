import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const po = await db.execute(`SELECT id, supplier_id FROM purchase_orders WHERE po_number = 'X0043'`);
if (po.rows.length > 0) {
  const poId = po.rows[0][0];
  const supplierId = po.rows[0][1];
  const now = new Date().toISOString();
  await db.execute({ sql: `INSERT INTO supplier_payments (supplier_id, purchase_order_id, amount_usd, payment_date, estimated_tons, price_per_ton, adjustment_status, notes, created_at) VALUES (?, ?, 297000, '2026-03-20', 540, 550, 'pending', 'Pago adelantado PO X0043 aprox 540 TN', ?)`, args: [supplierId, poId, now] });
  console.log("✅ Pago $297,000 registrado para PO X0043");
} else { 
  console.log("⚠️ PO X0043 no encontrado");
}
