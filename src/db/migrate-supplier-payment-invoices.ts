import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS supplier_payment_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL REFERENCES supplier_payments(id),
      invoice_id INTEGER REFERENCES invoices(id),
      invoice_number TEXT NOT NULL,
      estimated_tons REAL
    )
  `);

  // Also add pricePerTon to supplier_payments if it doesn't exist
  try {
    await client.execute(`ALTER TABLE supplier_payments ADD COLUMN price_per_ton REAL`);
    console.log("✓ Added price_per_ton column to supplier_payments");
  } catch {
    console.log("  price_per_ton already exists — skipping");
  }

  console.log("✓ supplier_payment_invoices table created");
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
