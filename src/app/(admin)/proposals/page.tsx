import { getProposals } from "@/server/queries";
import { ProposalsList } from "@/components/proposals-list";

export default async function ProposalsPage() {
  const proposals = await getProposals();
  return <ProposalsList proposals={proposals} />;
}
