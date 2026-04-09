// Run locally:  npx tsx src/db/migrate-bales.ts
// Run Turso:    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx src/db/migrate-bales.ts
import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  await client.execute(`ALTER TABLE invoices ADD COLUMN bales_count INTEGER`).catch(() => {});
  await client.execute(`ALTER TABLE invoices ADD COLUMN units_per_bale INTEGER`).catch(() => {});

  console.log("✓ bales_count and units_per_bale columns added to invoices");
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
