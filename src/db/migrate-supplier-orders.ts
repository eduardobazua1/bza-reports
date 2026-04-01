// Run: npx tsx src/db/migrate-supplier-orders.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS supplier_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
      order_date TEXT,
      tons REAL NOT NULL,
      price_per_ton REAL,
      incoterm TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ supplier_orders table created");
  await client.close();
}

main().catch(console.error);
