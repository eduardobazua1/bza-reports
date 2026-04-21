import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // Preview: which invoices will be updated
  const preview = await client.execute(`
    SELECT i.id, i.invoice_number, i.item, s.name AS supplier_name
    FROM invoices i
    JOIN purchase_orders po ON i.purchase_order_id = po.id
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE s.name LIKE '%Cascade%'
    ORDER BY i.invoice_number
  `);

  console.log(`Found ${preview.rows.length} invoices from Cascade supplier:`);
  for (const row of preview.rows) {
    console.log(`  [${row.id}] ${row.invoice_number} — current item: "${row.item}"`);
  }

  if (preview.rows.length === 0) {
    console.log("Nothing to update.");
    process.exit(0);
  }

  // Update
  const result = await client.execute(`
    UPDATE invoices
    SET item = 'Woodpulp - Softwood Cascade FSC Controlled Wood'
    WHERE id IN (
      SELECT i.id
      FROM invoices i
      JOIN purchase_orders po ON i.purchase_order_id = po.id
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE s.name LIKE '%Cascade%'
    )
  `);

  console.log(`\nUpdated ${result.rowsAffected} invoices to "Woodpulp - Softwood Cascade FSC Controlled Wood"`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
