// Run locally:  npx tsx src/db/migrate-suppliers-v2.ts
// Run Turso:    TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx src/db/migrate-suppliers-v2.ts
import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  const cols = [
    `ALTER TABLE suppliers ADD COLUMN country TEXT`,
    `ALTER TABLE suppliers ADD COLUMN city TEXT`,
    `ALTER TABLE suppliers ADD COLUMN state TEXT`,
    `ALTER TABLE suppliers ADD COLUMN zip TEXT`,
    `ALTER TABLE suppliers ADD COLUMN website TEXT`,
    `ALTER TABLE suppliers ADD COLUMN notes TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_name TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_beneficiary TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_account TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_routing TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_swift TEXT`,
    `ALTER TABLE suppliers ADD COLUMN bank_address TEXT`,
    `ALTER TABLE suppliers ADD COLUMN cert_type TEXT`,
    `ALTER TABLE suppliers ADD COLUMN pefc TEXT`,
  ];

  for (const sql of cols) {
    await client.execute(sql).catch(() => {}); // ignore "already exists" errors
  }

  console.log("✓ suppliers table updated with bank/contact/cert fields");
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
