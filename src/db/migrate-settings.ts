// Run: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx src/db/migrate-settings.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("✓ app_settings table created");
  await client.close();
}

main().catch(console.error);
