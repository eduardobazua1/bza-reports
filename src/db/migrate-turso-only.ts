import { createClient } from "@libsql/client";

const tursoUrl = process.env.TURSO_DATABASE_URL!;
const tursoToken = process.env.TURSO_AUTH_TOKEN!;

const client = createClient({ url: tursoUrl, authToken: tursoToken });

client.execute(`ALTER TABLE supplier_invoices ADD COLUMN linked_invoice_id INTEGER REFERENCES invoices(id)`)
  .then(() => { console.log("✓ linked_invoice_id added to Turso supplier_invoices"); client.close(); })
  .catch(e => { console.error("Error:", e.message); client.close(); });
