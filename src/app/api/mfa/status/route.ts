import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Reports whether the signed-in user currently has MFA enabled.
export async function GET() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await db.query.users.findFirst({ where: eq(users.id, Number(id)) });
  return NextResponse.json({ enabled: !!user?.totpEnabled });
}
