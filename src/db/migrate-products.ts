// Run: cd /Users/eduardobazua/bza-reports && npx tsx src/db/migrate-products.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT,
      description TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await client.execute(`ALTER TABLE purchase_orders ADD COLUMN supplier_product_id INTEGER REFERENCES products(id)`).catch(() => {});
  await client.execute(`ALTER TABLE purchase_orders ADD COLUMN client_product_id INTEGER REFERENCES products(id)`).catch(() => {});
  console.log("Migration done");
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
