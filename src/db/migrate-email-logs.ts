import { createClient } from "@libsql/client";

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoice_email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      invoice_number TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_to TEXT NOT NULL,
      sent_cc TEXT,
      attachment_count INTEGER DEFAULT 1,
      tracking_id TEXT NOT NULL UNIQUE,
      open_count INTEGER DEFAULT 0,
      first_opened_at TEXT,
      last_opened_at TEXT
    )
  `);

  console.log("✓ invoice_email_logs table created (or already exists)");
  await client.close();
}

// Run against local SQLite
migrate("file:sqlite.db")
  .then(() => {
    // If Turso creds available, also run against production
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (tursoUrl && tursoToken) {
      return migrate(tursoUrl, tursoToken).then(() => console.log("✓ Turso migration complete"));
    } else {
      console.log("No TURSO_DATABASE_URL found — skipping production migration");
    }
  })
  .catch(console.error);
