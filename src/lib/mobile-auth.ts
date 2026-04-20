import { NextRequest } from "next/server";

const SECRET = process.env.MOBILE_JWT_SECRET || "bza-mobile-secret-2025";

// Simple JWT-like token: base64(header).base64(payload).base64(sig)
// Using a lightweight approach without jsonwebtoken (edge-compatible)

function b64(s: string) {
  return Buffer.from(s).toString("base64url");
}
function unb64(s: string) {
  return Buffer.from(s, "base64url").toString("utf-8");
}
function sign(data: string, secret: string) {
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function signMobileToken(userId: number, email: string): string {
  const payload = b64(JSON.stringify({ userId, email, iat: Date.now() }));
  const header = b64(JSON.stringify({ alg: "HS256" }));
  const sig = sign(`${header}.${payload}`, SECRET);
  return `${header}.${payload}.${sig}`;
}

export function verifyMobileToken(req: NextRequest): { userId: number; email: string } | null {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return null;
    const [header, payload, sig] = token.split(".");
    const expected = sign(`${header}.${payload}`, SECRET);
    if (expected !== sig) return null;
    return JSON.parse(unb64(payload));
  } catch {
    return null;
  }
}
