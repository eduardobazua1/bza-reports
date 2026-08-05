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

// Retry a Turso query — backups shouldn't die on a transient network blip or a
// momentary Turso 5xx/400. Up to 8 tries with growing backoff (~1+2+…+8 ≈ 36s).
async function exec(c, stmt, tries = 8) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await c.execute(stmt);
    } catch (e) {
      lastErr = e;
      console.log(`  query retry ${i + 1}/${tries}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

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

  const schema = await exec(c, `select type, name, sql from sqlite_master
     where sql is not null and name not like 'sqlite_%'
     order by case type when 'table' then 0 when 'index' then 1 when 'trigger' then 2 else 3 end, name`);
  const parts = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
  let tables = 0, rows = 0;

  for (const t of schema.rows.filter((r) => r.type === "table")) {
    const name = String(t.name);
    parts.push(`${t.sql};`);
    tables++;
    // Read in small batches: Turso's HTTP API rejects a single response that is too
    // large (400), and these tables store base64 PDF blobs (tens of MB each).
    // Keyset pagination by rowid — O(n), avoids the O(n²) rescan that OFFSET causes on blob tables.
    const BATCH = 10; // ~2.6MB/response at ~430KB rows — fast and well under Turso's limit
    let lastRid = 0, cols = null, dataCols = null;
    for (;;) {
      const res = await exec(c, {
        sql: `SELECT rowid AS __rid, * FROM "${name}" WHERE rowid > ? ORDER BY rowid LIMIT ?`,
        args: [lastRid, BATCH],
      });
      if (res.rows.length === 0) break;
      if (!dataCols) {
        dataCols = res.columns.filter((x) => x !== "__rid");
        cols = dataCols.map((x) => `"${x}"`).join(", ");
      }
      for (const row of res.rows) {
        lastRid = row.__rid;
        parts.push(`INSERT INTO "${name}" (${cols}) VALUES (${dataCols.map((x) => esc(row[x])).join(", ")});`);
        rows++;
      }
      if (res.rows.length < BATCH) break;
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
