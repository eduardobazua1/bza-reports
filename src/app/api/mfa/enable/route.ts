import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, activityLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret, verifyToken } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Confirms enrollment: verifies a 6-digit code against the pending secret and,
// if valid, flips totpEnabled on.
export async function POST(req: NextRequest) {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: eq(users.id, Number(id)) });
  if (!user?.totpSecret) return NextResponse.json({ error: "Start setup first" }, { status: 400 });

  let ok = false;
  try { ok = verifyToken(decryptSecret(user.totpSecret), token); } catch { ok = false; }
  if (!ok) return NextResponse.json({ error: "That code isn't valid. Try the current one from your app." }, { status: 400 });

  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, Number(id)));
  try {
    await db.insert(activityLog).values({
      userId: Number(id), userName: user.name, userEmail: email,
      action: "update", entity: "auth", entityLabel: "MFA enabled",
      createdAt: new Date().toISOString(),
    });
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
