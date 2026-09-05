import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiMemory } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// PATCH /api/ai/memory/[id] → { fact?, topic?, active? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.fact === "string") patch.fact = body.fact.trim();
  if (typeof body.topic === "string") patch.topic = body.topic || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  await db.update(aiMemory).set(patch).where(eq(aiMemory.id, Number(id)));
  return NextResponse.json({ ok: true });
}

// DELETE /api/ai/memory/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(aiMemory).where(eq(aiMemory.id, Number(id)));
  return NextResponse.json({ ok: true });
}
