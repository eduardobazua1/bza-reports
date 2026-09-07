import { NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { STAGE_PROB } from "../route";

export const dynamic = "force-dynamic";

// PATCH → update fields / move stage. When stage changes, the probability snaps
// to that stage's default (unless a probability is explicitly provided), and
// won/lost set closedAt.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const fields = ["title", "clientId", "clientName", "product", "estimatedTons", "pricePerTon", "expectedCloseDate", "notes", "lostReason", "position", "probability"] as const;
  for (const f of fields) if (b[f] !== undefined) patch[f] = b[f];

  if (b.stage !== undefined) {
    patch.stage = b.stage;
    if (b.probability === undefined && STAGE_PROB[b.stage] !== undefined) patch.probability = STAGE_PROB[b.stage];
    patch.closedAt = (b.stage === "ganado" || b.stage === "perdido") ? new Date().toISOString() : null;
  }
  await db.update(opportunities).set(patch).where(eq(opportunities.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(opportunities).where(eq(opportunities.id, Number(id)));
  return NextResponse.json({ ok: true });
}
