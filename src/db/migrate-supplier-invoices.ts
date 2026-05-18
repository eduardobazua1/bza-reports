import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS supplier_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      invoice_number TEXT NOT NULL,
      invoice_date TEXT,
      estimated_tons REAL,
      amount_usd REAL,
      notes TEXT,
      file_name TEXT,
      file_url TEXT,
      file_size INTEGER,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log("✓ supplier_invoices table created");
  await client.close();
}

migrate("file:sqlite.db")
  .then(() => {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (tursoUrl && tursoToken) {
      return migrate(tursoUrl, tursoToken).then(() => console.log("✓ Turso migration complete"));
    } else {
      console.log("No TURSO_DATABASE_URL — skipping Turso migration");
    }
  })
  .catch(console.error);
