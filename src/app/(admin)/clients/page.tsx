import { getClients } from "@/server/queries";
import { ClientActions } from "@/components/client-actions";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
      </div>

      <ClientActions clients={clients} />
    </div>
  );
}
