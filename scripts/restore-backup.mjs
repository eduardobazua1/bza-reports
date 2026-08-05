// Decrypt + decompress a BZA TMS backup produced by /api/cron/backup.
//
// Usage:
//   BACKUP_ENCRYPTION_KEY=... node scripts/restore-backup.mjs <input.sql.gz.enc> [output.sql]
//
// Then load the resulting .sql into a fresh database, e.g.:
//   turso db shell <new-db> < restored.sql          (Turso)
//   sqlite3 restored.db < restored.sql              (local SQLite)
//
// The key MUST be the exact same BACKUP_ENCRYPTION_KEY used when the backup ran.
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { createDecipheriv, createHash } from "node:crypto";

const [input, output] = process.argv.slice(2);
if (!input) { console.error("Usage: node scripts/restore-backup.mjs <input.sql.gz.enc> [output.sql]"); process.exit(1); }
const secret = process.env.BACKUP_ENCRYPTION_KEY;
if (!secret) { console.error("BACKUP_ENCRYPTION_KEY env var is required (same value used to create the backup)."); process.exit(1); }

const blob = fs.readFileSync(input);
const iv = blob.subarray(0, 16);
const tag = blob.subarray(16, 32);
const ct = blob.subarray(32);

const key = createHash("sha256").update(secret).digest();
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const gz = Buffer.concat([decipher.update(ct), decipher.final()]);
const sql = gunzipSync(gz);

const out = output || input.replace(/\.sql\.gz\.enc$/, "") + ".sql";
fs.writeFileSync(out, sql);
console.log(`Restored ${sql.length.toLocaleString()} bytes of SQL → ${out}`);
