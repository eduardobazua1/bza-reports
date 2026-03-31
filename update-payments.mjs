import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// POs PAGADOS con sus fechas (del Excel)
const paidPOs = {
  'X0024': '2025-04-15',
  'X0025': '2025-05-09',
  'X0026': '2025-06-24',
  'X0027': '2025-05-25',
  'X0028': '2025-07-18',
  'X0029': '2025-08-04',
  'X0030': '2025-09-01',
  'X0031': '2025-09-04',
  'X0032': '2025-10-30',
  'X0033': '2025-09-15',
  'X0034': '2025-10-09',
  'X0035': '2025-10-20',
  'X0037': '2025-11-12',
  'X0038': '2025-12-02',
  'X0039': '2025-12-19',
};

// POs PENDIENTES (dejar como unpaid)
const unpaidPOs = ['X0036', 'X0040', 'X0041', 'X0042', 'X0043'];

let totalPaid = 0;
let totalUnpaid = 0;

// Mark paid
for (const [po, date] of Object.entries(paidPOs)) {
  const poRow = await db.execute({ sql: `SELECT id FROM purchase_orders WHERE po_number = ?`, args: [po] });
  if (poRow.rows.length > 0) {
    const poId = poRow.rows[0][0];
    const r = await db.execute({ 
      sql: `UPDATE invoices SET supplier_payment_status = 'paid', supplier_paid_date = ? WHERE purchase_order_id = ? AND supplier_payment_status = 'unpaid'`, 
      args: [date, poId] 
    });
    if (r.rowsAffected > 0) {
      console.log(`✅ ${po}: ${r.rowsAffected} invoices → paid (${date})`);
      totalPaid += r.rowsAffected;
    }
  }
}

// Ensure unpaid POs are unpaid
for (const po of unpaidPOs) {
  const poRow = await db.execute({ sql: `SELECT id FROM purchase_orders WHERE po_number = ?`, args: [po] });
  if (poRow.rows.length > 0) {
    const poId = poRow.rows[0][0];
    const r = await db.execute({ 
      sql: `UPDATE invoices SET supplier_payment_status = 'unpaid', supplier_paid_date = NULL WHERE purchase_order_id = ? AND supplier_payment_status = 'paid'`, 
      args: [poId] 
    });
    const count = await db.execute({ sql: `SELECT COUNT(*) as n FROM invoices WHERE purchase_order_id = ?`, args: [poId] });
    console.log(`⏳ ${po}: ${count.rows[0][0]} invoices → unpaid (pendiente)`);
    totalUnpaid += Number(count.rows[0][0]);
  }
}

console.log(`\n✅ Total paid updated: ${totalPaid} invoices`);
console.log(`⏳ Total pending: ${totalUnpaid} invoices`);
