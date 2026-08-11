import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newSecret, otpauthURL, encryptSecret } from "@/lib/totp";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

// Begins TOTP enrollment: generates a fresh secret, stores it (encrypted, not yet
// enabled), and returns the otpauth URI + a QR data URL to scan.
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  const id = session?.user?.id;
  if (!email || !id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const base32 = newSecret();
    const url = otpauthURL(base32, email);
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });

    // Store the pending secret encrypted; enabled stays false until verified.
    await db.update(users)
      .set({ totpSecret: encryptSecret(base32), totpEnabled: false })
      .where(eq(users.id, Number(id)));

    return NextResponse.json({ ok: true, qrDataUrl, secret: base32, otpauthUrl: url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "setup failed" }, { status: 500 });
  }
}
