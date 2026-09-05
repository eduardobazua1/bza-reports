import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/ai/conversations/[id] → { conversation, messages }
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const conv = await db.select().from(aiConversations).where(eq(aiConversations.id, cid)).limit(1);
  if (!conv.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const msgs = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, cid)).orderBy(asc(aiMessages.id));
  const messages = msgs.map((m) => ({
    role: m.role,
    content: m.content,
    imageUrls: m.imageUrls ? JSON.parse(m.imageUrls) : undefined,
  }));
  return NextResponse.json({ conversation: conv[0], messages });
}

// PUT /api/ai/conversations/[id] → replace the thread's messages (autosave)
// body: { title?, messages: [{role, content, imageUrls?}] }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const body = await req.json();
  const now = new Date().toISOString();
  const messages: { role: string; content: string; imageUrls?: string[] }[] = body.messages || [];

  await db.delete(aiMessages).where(eq(aiMessages.conversationId, cid));
  if (messages.length) {
    await db.insert(aiMessages).values(messages.map((m) => ({
      conversationId: cid,
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content ?? "",
      imageUrls: m.imageUrls && m.imageUrls.length ? JSON.stringify(m.imageUrls) : null,
      createdAt: now,
    })));
  }
  const title = (body.title as string | undefined)?.slice(0, 120);
  await db.update(aiConversations).set({ ...(title ? { title } : {}), updatedAt: now }).where(eq(aiConversations.id, cid));
  return NextResponse.json({ ok: true });
}

// DELETE /api/ai/conversations/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  await db.delete(aiMessages).where(eq(aiMessages.conversationId, cid));
  await db.delete(aiConversations).where(eq(aiConversations.id, cid));
  return NextResponse.json({ ok: true });
}
