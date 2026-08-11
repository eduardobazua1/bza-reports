import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// ── Encrypt Plaid access tokens at rest (AES-256-GCM) ────────────────────────
// The access token grants access to bank data, so it is never stored in plaintext.
// Reuses BACKUP_ENCRYPTION_KEY (already set), or a dedicated PLAID_ENCRYPTION_KEY.
function tokenKey(): Buffer {
  const secret = process.env.PLAID_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) throw new Error("No encryption key set (PLAID_ENCRYPTION_KEY / BACKUP_ENCRYPTION_KEY) for Plaid tokens.");
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64"); // [iv|tag|ct]
}

export function decryptToken(enc: string): string {
  const b = Buffer.from(enc, "base64");
  const iv = b.subarray(0, 16), tag = b.subarray(16, 32), ct = b.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// Which Plaid environment: sandbox (fake banks, free) | production (real banks).
const ENV = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

export function plaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidClient(): PlaidApi {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(configuration);
}

// Map a Plaid account subtype to the TMS bank_accounts.account_type enum.
export function mapAccountType(subtype: string | null | undefined): "checking" | "money_market" | "savings" | "other" {
  const s = (subtype || "").toLowerCase();
  if (s.includes("checking")) return "checking";
  if (s.includes("money")) return "money_market";
  if (s.includes("saving")) return "savings";
  return "other";
}
