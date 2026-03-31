import { createClient } from "@libsql/client";
const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// Clear all existing payments and repopulate with per-PO breakdown
await db.execute(`DELETE FROM supplier_payments`);

// Get PO costs from DB
const costs = await db.execute(`
  SELECT po.id, po.po_number, po.supplier_id,
    SUM(i.quantity_tons * COALESCE(i.buy_price_override, po.buy_price)) as cost
  FROM purchase_orders po
  LEFT JOIN invoices i ON i.purchase_order_id = po.id
  WHERE po.po_number >= 'X0022'
  GROUP BY po.id, po.po_number, po.supplier_id
  ORDER BY po.po_number
`);

// Payment dates from Excel (NOTA column)
const paymentDates = {
  'X0024': '2025-04-15', 'X0025': '2025-05-09', 'X0026': '2025-06-24',
  'X0027': '2025-05-25', 'X0028': '2025-07-18', 'X0029': '2025-08-04',
  'X0030': '2025-09-01', 'X0031': '2025-09-04', 'X0032': '2025-10-30',
  'X0033': '2025-09-15', 'X0034': '2025-10-09', 'X0035': '2025-10-20',
  'X0037': '2025-11-12', 'X0038': '2025-12-02', 'X0039': '2025-12-19',
  'X0043': '2026-03-20',
};

const now = new Date().toISOString();
let totalInserted = 0;

for (const row of costs.rows) {
  const poNumber = String(row[1]);
  const supplierId = Number(row[2]);
  const cost = Number(row[3]);
  const poId = Number(row[0]);
  const date = paymentDates[poNumber];
  
  if (!date || !cost || cost === 0) continue; // skip unpaid or no-cost POs

  await db.execute({
    sql: `INSERT INTO supplier_payments (supplier_id, purchase_order_id, amount_usd, payment_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [supplierId, poId, Math.round(cost * 100) / 100, date, `Pago PO ${poNumber}`, now]
  });
  console.log(`✅ ${poNumber}: $${cost.toFixed(2)} (${date})`);
  totalInserted++;
}

const total = await db.execute(`SELECT SUM(amount_usd) FROM supplier_payments`);
console.log(`\nTotal registrado: $${Number(total.rows[0][0]).toFixed(2)} (${totalInserted} pagos)`);
