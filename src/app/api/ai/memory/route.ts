import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiMemory } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/ai/memory → all memories (active + inactive)
export async function GET() {
  const rows = await db.select().from(aiMemory).orderBy(desc(aiMemory.active), desc(aiMemory.updatedAt));
  return NextResponse.json(rows);
}

// POST /api/ai/memory → add a memory { fact, topic? }
export async function POST(req: Request) {
  const body = await req.json();
  const fact = (body.fact as string || "").trim();
  if (!fact) return NextResponse.json({ error: "fact required" }, { status: 400 });
  const now = new Date().toISOString();
  const [row] = await db.insert(aiMemory).values({
    fact, topic: (body.topic as string) || null, source: "user", active: true, createdAt: now, updatedAt: now,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
