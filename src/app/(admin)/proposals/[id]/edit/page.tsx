import { notFound } from "next/navigation";
import { getClients, getProposal } from "@/server/queries";
import { ProposalForm } from "@/components/proposal-form";

export default async function EditProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proposal, clients] = await Promise.all([
    getProposal(Number(id)),
    getClients(),
  ]);
  if (!proposal) notFound();

  return (
    <ProposalForm
      mode="edit"
      proposalId={proposal.id}
      proposalNumber={proposal.proposalNumber}
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      defaultValues={{
        clientId: proposal.clientId,
        title: proposal.title,
        proposalDate: proposal.proposalDate,
        validUntil: proposal.validUntil || "",
        status: proposal.status as "draft" | "sent" | "accepted" | "declined",
        incoterm: proposal.incoterm || "",
        paymentTerms: proposal.paymentTerms || "",
        notes: proposal.notes || "",
        items: proposal.items.map((it, i) => ({
          id: String(it.id),
          sort: it.sort,
          product: it.product,
          description: it.description || "",
          tons: String(it.tons),
          unit: it.unit,
          pricePerTon: String(it.pricePerTon),
          certType: it.certType || "",
          certDetail: it.certDetail || "",
        })),
      }}
    />
  );
}
