import { NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const STAGE_PROB: Record<string, number> = {
  prospecto: 10, cotizacion: 30, muestra: 50, negociacion: 75, ganado: 100, perdido: 0,
};

// GET /api/pipeline → all opportunities with client name resolved
export async function GET() {
  const rows = await db
    .select({
      id: opportunities.id, title: opportunities.title, clientId: opportunities.clientId,
      clientNameRaw: opportunities.clientName, clientName: clients.name, product: opportunities.product,
      estimatedTons: opportunities.estimatedTons, pricePerTon: opportunities.pricePerTon,
      stage: opportunities.stage, probability: opportunities.probability,
      expectedCloseDate: opportunities.expectedCloseDate, notes: opportunities.notes,
      lostReason: opportunities.lostReason, position: opportunities.position,
      closedAt: opportunities.closedAt, updatedAt: opportunities.updatedAt,
    })
    .from(opportunities)
    .leftJoin(clients, eq(opportunities.clientId, clients.id))
    .orderBy(opportunities.position, desc(opportunities.updatedAt));
  const out = rows.map((r) => ({ ...r, clientName: r.clientName || r.clientNameRaw || null }));
  return NextResponse.json(out);
}

// POST → create an opportunity
export async function POST(req: Request) {
  const b = await req.json();
  const now = new Date().toISOString();
  const stage = (b.stage as string) || "prospecto";
  const [row] = await db.insert(opportunities).values({
    title: (b.title as string || "Untitled").slice(0, 200),
    clientId: b.clientId ? Number(b.clientId) : null,
    clientName: (b.clientName as string) || null,
    product: (b.product as string) || null,
    estimatedTons: Number(b.estimatedTons) || 0,
    pricePerTon: Number(b.pricePerTon) || 0,
    stage: stage as "prospecto" | "cotizacion" | "muestra" | "negociacion" | "ganado" | "perdido",
    probability: b.probability != null ? Number(b.probability) : (STAGE_PROB[stage] ?? 10),
    expectedCloseDate: (b.expectedCloseDate as string) || null,
    notes: (b.notes as string) || null,
    position: Date.now(),
    closedAt: stage === "ganado" || stage === "perdido" ? now : null,
    createdAt: now, updatedAt: now,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
