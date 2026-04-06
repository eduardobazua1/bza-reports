import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'wire_transfer',
      reference_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS customer_payment_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL REFERENCES customer_payments(id),
      invoice_id INTEGER REFERENCES invoices(id),
      invoice_number TEXT NOT NULL,
      amount REAL NOT NULL
    )
  `);

  console.log("✓ customer_payments and customer_payment_invoices tables created");
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
