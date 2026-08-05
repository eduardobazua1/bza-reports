// Standalone encrypted database backup — runs in GitHub Actions (no serverless time limit).
//
// Dumps the ENTIRE Turso database to a faithful SQL file, gzips it, encrypts it
// (AES-256-GCM), and uploads it to Vercel Blob with retention. The stored copy is
// unreadable without BACKUP_ENCRYPTION_KEY. Restore with scripts/restore-backup.mjs.
//
// Required env (GitHub Actions secrets):
//   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, BACKUP_ENCRYPTION_KEY, BLOB_READ_WRITE_TOKEN
// Optional: BACKUP_RETENTION (default 14)
import { createClient } from "@libsql/client";
import { put, list, del } from "@vercel/blob";
import { gzipSync } from "node:zlib";
import { createCipheriv, randomBytes, createHash } from "node:crypto";

const RETENTION = Number(process.env.BACKUP_RETENTION || 14);
const PREFIX = "backups/";

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof ArrayBuffer) return "X'" + Buffer.from(v).toString("hex") + "'";
  if (ArrayBuffer.isView(v)) return "X'" + Buffer.from(v.buffer).toString("hex") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function buildDump() {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing.");
  const c = createClient({ url, authToken });

  const schema = await c.execute(
    `select type, name, sql from sqlite_master
     where sql is not null and name not like 'sqlite_%'
     order by case type when 'table' then 0 when 'index' then 1 when 'trigger' then 2 else 3 end, name`
  );
  const parts = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
  let tables = 0, rows = 0;

  for (const t of schema.rows.filter((r) => r.type === "table")) {
    const name = String(t.name);
    parts.push(`${t.sql};`);
    tables++;
    const res = await c.execute(`SELECT * FROM "${name}"`);
    const cols = res.columns.map((x) => `"${x}"`).join(", ");
    for (const row of res.rows) {
      parts.push(`INSERT INTO "${name}" (${cols}) VALUES (${res.columns.map((x) => esc(row[x])).join(", ")});`);
      rows++;
    }
  }
  for (const o of schema.rows.filter((r) => r.type !== "table")) parts.push(`${o.sql};`);
  parts.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
  return { sql: parts.join("\n"), tables, rows };
}

function encrypt(buf) {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error("BACKUP_ENCRYPTION_KEY is not set — refusing to store an unencrypted backup.");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

async function main() {
  const started = Date.now();
  const { sql, tables, rows } = await buildDump();
  const gz = gzipSync(Buffer.from(sql, "utf8"), { level: 6 });
  const enc = encrypt(gz);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${PREFIX}bza-${stamp}.sql.gz.enc`;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set.");

  const res = await put(filename, enc, {
    access: "public", // encrypted payload → safe
    addRandomSuffix: false,
    contentType: "application/octet-stream",
    token,
  });

  // Retention: keep the newest RETENTION, delete older.
  const { blobs } = await list({ prefix: PREFIX, token });
  const stale = blobs
    .filter((b) => b.pathname.endsWith(".sql.gz.enc"))
    .sort((a, b) => b.pathname.localeCompare(a.pathname))
    .slice(RETENTION);
  for (const b of stale) await del(b.url, { token });

  console.log(JSON.stringify({
    ok: true, filename, url: res.url, tables, rows,
    rawBytes: Buffer.byteLength(sql), storedBytes: enc.length,
    retained: RETENTION, pruned: stale.length, ms: Date.now() - started,
  }, null, 2));
}

main().catch((e) => { console.error("BACKUP FAILED:", e); process.exit(1); });
