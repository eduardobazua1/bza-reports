import { NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNextProposalNumber } from "@/server/queries";
import { createProposal } from "@/server/actions";
import { STAGE_PROB } from "../../route";

export const dynamic = "force-dynamic";

// POST /api/pipeline/[id]/quote → create a Proposal (quote) from this opportunity,
// link it back, and move the deal to the "cotizacion" stage.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await db.select().from(opportunities).where(eq(opportunities.id, Number(id))).limit(1);
  if (!opp.length) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  const o = opp[0];
  if (!o.clientId) {
    return NextResponse.json({ error: "This deal has no linked client. Pick an existing client on the deal first (a quote/proposal requires a real client)." }, { status: 400 });
  }
  if (o.proposalId) {
    return NextResponse.json({ proposalId: o.proposalId, existing: true });
  }

  const proposalNumber = await getNextProposalNumber();
  const today = new Date().toISOString().slice(0, 10);
  const proposalId = await createProposal({
    proposalNumber,
    clientId: o.clientId,
    title: o.title || "Quote",
    proposalDate: today,
    status: "draft",
    incoterm: o.incoterm || undefined,
    items: [{
      sort: 0,
      product: o.product || o.title || "Product",
      tons: o.estimatedTons || 0,
      unit: "MT",
      pricePerTon: o.pricePerTon || 0,
    }],
  });

  await db.update(opportunities).set({
    proposalId,
    stage: "cotizacion",
    probability: STAGE_PROB.cotizacion,
    updatedAt: new Date().toISOString(),
  }).where(eq(opportunities.id, o.id));

  return NextResponse.json({ proposalId, proposalNumber });
}
