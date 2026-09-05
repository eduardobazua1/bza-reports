import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/ai/conversations → list threads, newest first
export async function GET() {
  const rows = await db.select().from(aiConversations).orderBy(desc(aiConversations.updatedAt)).limit(100);
  return NextResponse.json(rows);
}

// POST /api/ai/conversations → create a new thread { title? } → { id }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const title = (body.title as string || "New conversation").slice(0, 120);
  const [row] = await db.insert(aiConversations).values({ title, createdAt: now, updatedAt: now }).returning();
  return NextResponse.json(row, { status: 201 });
}
