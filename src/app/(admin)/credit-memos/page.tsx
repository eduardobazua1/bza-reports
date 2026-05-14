import { getCreditMemos, getClients, getUnpaidInvoicesForPayments } from "@/server/queries";
import { CreditMemosPanel } from "@/components/credit-memos-panel";

export default async function CreditMemosPage() {
  const [memos, clients, unpaidInvs] = await Promise.all([
    getCreditMemos(),
    getClients(),
    getUnpaidInvoicesForPayments(),
  ]);

  // Build invoice options for the form dropdown
  const invoices = unpaidInvs.map(i => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId ?? 0,
    amount: i.quantityTons * i.sellPrice,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Credit Memos</h1>
      </div>
      <CreditMemosPanel
        memos={memos as any}
        clients={clients.map(c => ({ id: c.id, name: c.name }))}
        invoices={invoices}
      />
    </div>
  );
}
