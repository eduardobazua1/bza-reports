import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

// Find Cascade supplier
const cascade = await db.execute(`SELECT id, name FROM suppliers WHERE name LIKE '%Cascade%'`);
console.log("Cascade:", cascade.rows);

if (cascade.rows.length > 0) {
  const supplierId = cascade.rows[0][0];
  
  // Find all POs for Cascade BEFORE X0043 (excluding X0043)
  const pos = await db.execute({ 
    sql: `SELECT id, po_number FROM purchase_orders WHERE supplier_id = ? AND po_number < 'X0043'`,
    args: [supplierId]
  });
  console.log("POs before X0043:", pos.rows.map(r => r[1]));

  if (pos.rows.length > 0) {
    const poIds = pos.rows.map(r => r[0]);
    for (const poId of poIds) {
      const result = await db.execute({
        sql: `UPDATE invoices SET supplier_payment_status = 'paid', supplier_paid_date = supplier_paid_date WHERE purchase_order_id = ? AND supplier_payment_status = 'unpaid'`,
        args: [poId]
      });
      console.log(`PO ${poId}: ${result.rowsAffected} invoices marked paid`);
    }
  }
}
console.log("Done");
