import { getContracts, getClients, getSuppliers, getNextContractNumber } from "@/server/queries";
import { ContractsList } from "@/components/contracts-list";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [rows, clientsList, suppliersList, nextNumber] = await Promise.all([
    getContracts(),
    getClients(),
    getSuppliers(),
    getNextContractNumber(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contracts</h1>
      <ContractsList
        contracts={rows as any}
        clients={clientsList}
        suppliers={suppliersList}
        nextContractNumber={nextNumber}
      />
    </div>
  );
}
