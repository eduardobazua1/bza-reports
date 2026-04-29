import { getClients, getNextProposalNumber, getProducts } from "@/server/queries";
import { ProposalForm } from "@/components/proposal-form";

export default async function NewProposalPage() {
  const [clients, proposalNumber, products] = await Promise.all([
    getClients(),
    getNextProposalNumber(),
    getProducts(),
  ]);

  return (
    <ProposalForm
      mode="new"
      proposalNumber={proposalNumber}
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      products={products.map(p => ({ id: p.id, name: p.name, grade: p.grade ?? null }))}
    />
  );
}
