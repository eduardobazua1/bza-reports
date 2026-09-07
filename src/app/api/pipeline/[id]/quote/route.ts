import { NextResponse } from "next/server";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNextProposalNumber, getProposal } from "@/server/queries";
import { createProposal, updateProposal } from "@/server/actions";
import { STAGE_PROB } from "../../route";

export const dynamic = "force-dynamic";

// GET → the linked proposal summary (or { linked:false })
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await db.select().from(opportunities).where(eq(opportunities.id, Number(id))).limit(1);
  if (!opp.length || !opp[0].proposalId) return NextResponse.json({ linked: false });
  const p = await getProposal(opp[0].proposalId);
  if (!p) return NextResponse.json({ linked: false });
  return NextResponse.json({ linked: true, proposalId: p.id, proposalNumber: p.proposalNumber, status: p.status, paymentTerms: p.paymentTerms, validUntil: p.validUntil });
}

// POST → create the linked proposal from the deal (first time), or update its
// header (payment terms / valid until / incoterm) if it already exists.
// body: { paymentTerms?, validUntil? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const opp = await db.select().from(opportunities).where(eq(opportunities.id, Number(id))).limit(1);
  if (!opp.length) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  const o = opp[0];
  if (!o.clientId) {
    return NextResponse.json({ error: "This deal has no linked client. Pick an existing client on the deal first (a quote requires a real client)." }, { status: 400 });
  }

  if (o.proposalId) {
    await updateProposal(o.proposalId, {
      incoterm: o.incoterm || undefined,
      paymentTerms: (body.paymentTerms as string) || undefined,
      validUntil: (body.validUntil as string) || undefined,
    });
    const p = await getProposal(o.proposalId);
    return NextResponse.json({ proposalId: o.proposalId, proposalNumber: p?.proposalNumber, updated: true });
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
    paymentTerms: (body.paymentTerms as string) || undefined,
    validUntil: (body.validUntil as string) || undefined,
    items: [{ sort: 0, product: o.product || o.title || "Product", tons: o.estimatedTons || 0, unit: "MT", pricePerTon: o.pricePerTon || 0 }],
  });
  await db.update(opportunities).set({ proposalId, stage: "cotizacion", probability: STAGE_PROB.cotizacion, updatedAt: new Date().toISOString() }).where(eq(opportunities.id, o.id));
  return NextResponse.json({ proposalId, proposalNumber });
}
