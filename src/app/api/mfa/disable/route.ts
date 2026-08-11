import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, activityLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret, verifyToken } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Turns MFA off — requires a valid current code so a walk-up attacker on an open
// session can't silently remove the second factor.
export async function POST(req: NextRequest) {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = await req.json().catch(() => ({}));
  const user = await db.query.users.findFirst({ where: eq(users.id, Number(id)) });
  if (!user?.totpEnabled || !user.totpSecret) return NextResponse.json({ ok: true });

  let ok = false;
  try { ok = verifyToken(decryptSecret(user.totpSecret), token || ""); } catch { ok = false; }
  if (!ok) return NextResponse.json({ error: "Enter a valid current code to disable MFA." }, { status: 400 });

  await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, Number(id)));
  try {
    await db.insert(activityLog).values({
      userId: Number(id), userName: user.name, userEmail: email,
      action: "update", entity: "auth", entityLabel: "MFA disabled",
      createdAt: new Date().toISOString(),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
