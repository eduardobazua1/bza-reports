import { notFound } from "next/navigation";
import { getClients, getProposal, getProducts } from "@/server/queries";
import { ProposalForm } from "@/components/proposal-form";

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proposal, clients, products] = await Promise.all([
    getProposal(Number(id)),
    getClients(),
    getProducts(),
  ]);
  if (!proposal) notFound();

  return (
    <ProposalForm
      mode="edit"
      proposalId={proposal.id}
      proposalNumber={proposal.proposalNumber}
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      products={products.map(p => ({ id: p.id, name: p.name, grade: p.grade ?? null }))}
      defaultValues={{
        clientId:     proposal.clientId,
        title:        proposal.title,
        proposalDate: proposal.proposalDate,
        validUntil:   proposal.validUntil  || "",
        status:       proposal.status as "draft" | "sent" | "accepted" | "declined",
        incoterm:     proposal.incoterm    || "",
        paymentTerms: proposal.paymentTerms || "",
        notes:        proposal.notes       || "",
        items: proposal.items.map(it => ({
          id:          String(it.id),
          sort:        it.sort,
          product:     it.product,
          description: it.description  || "",
          tons:        String(it.tons),
          unit:        it.unit,
          pricePerTon: String(it.pricePerTon),
          certType:    it.certType    || "",
          certDetail:  it.certDetail  || "",
        })),
      }}
    />
  );
}
