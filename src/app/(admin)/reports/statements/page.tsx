import { getClients, getClientStatement } from "@/server/queries";
import { StatementClient } from "@/components/reports/statement-client";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: { client?: string; from?: string; to?: string };
}) {
  const clients = await getClients();

  const clientId = searchParams.client ? Number(searchParams.client) : null;
  const fromDate = searchParams.from ?? "";
  const toDate   = searchParams.to   ?? "";

  const statement = clientId
    ? await getClientStatement(clientId, fromDate || undefined, toDate || undefined)
    : null;

  return (
    <StatementClient
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      initialClientId={clientId}
      initialFrom={fromDate}
      initialTo={toDate}
      statement={statement}
    />
  );
}
