import { getClients, getClientStatement } from "@/server/queries";
import { StatementClient } from "@/components/reports/statement-client";

export const dynamic = "force-dynamic";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; from?: string; to?: string }>;
}) {
  const clients = await getClients();
  const sp = await searchParams;

  const clientId = sp.client ? Number(sp.client) : null;
  const fromDate = sp.from ?? "";
  const toDate   = sp.to   ?? "";

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
