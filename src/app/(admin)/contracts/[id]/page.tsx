import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getContractWithPos, getClients, getSuppliers, getEligiblePosForContract } from "@/server/queries";
import { ContractDetailActions } from "@/components/contract-detail-actions";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContractWithPos(Number(id));
  if (!contract) notFound();

  const [clientsList, suppliersList, eligiblePos] = await Promise.all([
    getClients(),
    getSuppliers(),
    getEligiblePosForContract(contract.id, contract.clientId, contract.supplierId),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/contracts" className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600">
          <ArrowLeft className="w-4 h-4" /> Contracts
        </Link>
        <span className="text-stone-200">/</span>
        <h1 className="text-2xl font-bold">{contract.contractNumber}</h1>
      </div>

      <ContractDetailActions
        contract={contract as any}
        clients={clientsList}
        suppliers={suppliersList}
        eligiblePos={eligiblePos}
      />
    </div>
  );
}
