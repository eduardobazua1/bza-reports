import { notFound } from "next/navigation";
import { getProposal } from "@/server/queries";
import { ProposalDetail } from "@/components/proposal-detail";

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = await getProposal(Number(id));
  if (!proposal) notFound();
  return <ProposalDetail proposal={proposal} />;
}
