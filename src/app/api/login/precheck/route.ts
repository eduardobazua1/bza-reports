import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// Login step 1: verify email + password so the login form knows whether to ask
// for a second factor. Returns only booleans — no session is created here.
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ valid: false });

  const user = await db.query.users.findFirst({ where: eq(users.email, email as string) });
  if (!user || !user.isActive) return NextResponse.json({ valid: false });

  const ok = await bcrypt.compare(password as string, user.passwordHash);
  if (!ok) return NextResponse.json({ valid: false });

  return NextResponse.json({ valid: true, mfaRequired: !!user.totpEnabled });
}
