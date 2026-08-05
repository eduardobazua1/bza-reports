// One-off: create the activity_log table in Turso (additive — touches no existing data).
// Run from bza-reports root:  npx tsx src/db/create-activity-log.ts
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

function loadEnv() {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* ignore */ }
  return env;
}

async function main() {
  const env = loadEnv();
  const url = process.env.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL not found");

  const client = createClient({ url, authToken });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      entity_label TEXT,
      changes TEXT,
      meta TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log (entity, entity_id)`);

  const res = await client.execute(`SELECT count(*) AS n FROM activity_log`);
  console.log("activity_log ready. rows:", res.rows[0]?.n);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
