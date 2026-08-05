import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { put, list, del } from "@vercel/blob";
import { gzipSync } from "node:zlib";
import { createCipheriv, randomBytes, createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // full dump of blob-heavy tables can take a while

// ── Automated, encrypted, off-provider database backup ───────────────────────
// Runs daily via Vercel Cron. Produces a faithful SQL dump of the ENTIRE Turso
// database, gzips it, encrypts it (AES-256-GCM), and stores it with retention.
// The dump is encrypted BEFORE it ever leaves the function, so the stored copy
// is unreadable without BACKUP_ENCRYPTION_KEY — even via a public blob URL.
//
// Destination is pluggable: today Vercel Blob; switching to S3/Cloudflare R2
// later is a change confined to uploadBackup()/pruneOldBackups() only.

// ~82 MB/day at current data size. Keep it modest on Vercel Blob; raise once on R2/S3.
const RETENTION = Number(process.env.BACKUP_RETENTION || 7);
const PREFIX = "backups/";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

// SQL-escape a single value the way sqlite's own .dump does.
function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof ArrayBuffer) return "X'" + Buffer.from(v).toString("hex") + "'";
  if (ArrayBuffer.isView(v)) return "X'" + Buffer.from(v.buffer).toString("hex") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function buildSqlDump(): Promise<{ sql: string; tables: number; rows: number }> {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL!;
  const authToken = process.env.TURSO_AUTH_TOKEN!;
  const c = createClient({ url, authToken });

  const schema = await c.execute(
    `select type, name, sql from sqlite_master
     where sql is not null and name not like 'sqlite_%'
     order by case type when 'table' then 0 when 'index' then 1 when 'trigger' then 2 else 3 end, name`
  );

  const parts: string[] = [
    `-- BZA TMS database backup`,
    `-- generated ${new Date().toISOString()}`,
    `PRAGMA foreign_keys=OFF;`,
    `BEGIN TRANSACTION;`,
  ];

  let tableCount = 0;
  let rowCount = 0;

  // Tables (schema + data) first, in dependency-friendly order.
  const tables = schema.rows.filter((r) => r.type === "table");
  for (const t of tables) {
    const name = String(t.name);
    parts.push(`${t.sql};`);
    tableCount++;

    // Stream rows in batches so a huge (blob-heavy) table doesn't explode memory.
    const BATCH = 250;
    let offset = 0;
    for (;;) {
      const res = await c.execute({ sql: `SELECT * FROM "${name}" LIMIT ? OFFSET ?`, args: [BATCH, offset] });
      if (res.rows.length === 0) break;
      const cols = res.columns.map((col) => `"${col}"`).join(", ");
      for (const row of res.rows) {
        const vals = res.columns.map((col) => esc((row as Record<string, unknown>)[col])).join(", ");
        parts.push(`INSERT INTO "${name}" (${cols}) VALUES (${vals});`);
        rowCount++;
      }
      offset += res.rows.length;
      if (res.rows.length < BATCH) break;
    }
  }

  // Indexes / triggers / views after the data.
  for (const o of schema.rows.filter((r) => r.type !== "table")) parts.push(`${o.sql};`);

  parts.push(`COMMIT;`, `PRAGMA foreign_keys=ON;`, "");
  return { sql: parts.join("\n"), tables: tableCount, rows: rowCount };
}

// AES-256-GCM. Output layout: [16-byte IV][16-byte auth tag][ciphertext].
// Key = SHA-256(BACKUP_ENCRYPTION_KEY) so any passphrase length works.
function encrypt(buf: Buffer): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error("BACKUP_ENCRYPTION_KEY is not set — refusing to store an unencrypted backup.");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

async function uploadBackup(filename: string, body: Buffer) {
  // Encrypted payload → a public blob URL is safe (contents are unreadable without the key).
  const token = process.env.BLOB_READ_WRITE_TOKEN; // provided automatically on Vercel when Blob is connected
  const res = await put(PREFIX + filename, body, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/octet-stream",
    token,
  });
  return res.url;
}

async function pruneOldBackups(): Promise<number> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const { blobs } = await list({ prefix: PREFIX, token });
  const sorted = blobs
    .filter((b) => b.pathname.endsWith(".sql.gz.enc"))
    .sort((a, b) => b.pathname.localeCompare(a.pathname)); // newest first (timestamped names)
  const stale = sorted.slice(RETENTION);
  for (const b of stale) await del(b.url, { token });
  return stale.length;
}

async function runBackup() {
  const started = Date.now();
  const { sql, tables, rows } = await buildSqlDump();
  const gz = gzipSync(Buffer.from(sql, "utf8"), { level: 6 });
  const enc = encrypt(gz);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `bza-${stamp}.sql.gz.enc`;
  const url = await uploadBackup(filename, enc);
  const pruned = await pruneOldBackups();

  return {
    ok: true,
    filename,
    url,
    tables,
    rows,
    rawBytes: Buffer.byteLength(sql),
    storedBytes: enc.length,
    encrypted: true,
    retained: RETENTION,
    pruned,
    ms: Date.now() - started,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runBackup());
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runBackup());
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
