import { getClients, getNextProposalNumber } from "@/server/queries";
import { ProposalForm } from "@/components/proposal-form";

export default async function NewProposalPage() {
  const [clients, proposalNumber] = await Promise.all([
    getClients(),
    getNextProposalNumber(),
  ]);

  return (
    <ProposalForm
      mode="new"
      proposalNumber={proposalNumber}
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
    />
  );
}
