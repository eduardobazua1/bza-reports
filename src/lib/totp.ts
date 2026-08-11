import { TOTP, Secret } from "otpauth";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// ── TOTP (Google Authenticator-style) multi-factor auth for the TMS login ─────
// The shared secret is encrypted at rest with AES-256-GCM, reusing the same
// key material as the Plaid tokens and backups (BACKUP_ENCRYPTION_KEY).

const ISSUER = "BZA TMS";

function key(): Buffer {
  const secret = process.env.PLAID_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error("No encryption key set (BACKUP_ENCRYPTION_KEY) for TOTP secrets.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64"); // [iv|tag|ct]
}

export function decryptSecret(enc: string): string {
  const b = Buffer.from(enc, "base64");
  const iv = b.subarray(0, 16), tag = b.subarray(16, 32), ct = b.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Generate a fresh base32 secret for enrollment.
export function newSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(base32: string, email?: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: email || "account",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32),
  });
}

// otpauth:// URI to encode into the enrollment QR code.
export function otpauthURL(base32: string, email: string): string {
  return totpFor(base32, email).toString();
}

// Verify a 6-digit code against the secret (±1 step tolerance for clock drift).
export function verifyToken(base32: string, token: string): boolean {
  const clean = (token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const delta = totpFor(base32).validate({ token: clean, window: 1 });
  return delta !== null;
}
