import { db } from "@/db";
import { portalUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/portal-users?clientId=3
export async function GET(req: NextRequest) {
  const clientId = Number(req.nextUrl.searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([], { status: 400 });

  const users = await db.select().from(portalUsers).where(eq(portalUsers.clientId, clientId));
  return NextResponse.json(users);
}

// POST /api/portal-users — add a portal user
export async function POST(req: NextRequest) {
  const { clientId, email, name } = await req.json();
  if (!clientId || !email || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check if already exists
  const existing = await db.query.portalUsers.findFirst({
    where: and(eq(portalUsers.clientId, clientId), eq(portalUsers.email, email.toLowerCase().trim())),
  });
  if (existing) {
    return NextResponse.json({ error: "Email already authorized" }, { status: 409 });
  }

  const result = await db.insert(portalUsers).values({
    clientId,
    email: email.toLowerCase().trim(),
    name: name.trim(),
  }).returning();

  return NextResponse.json(result[0]);
}

// DELETE /api/portal-users — remove a portal user
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(portalUsers).where(eq(portalUsers.id, id));
  return NextResponse.json({ ok: true });
}
