import { getCustomerPaymentsWithInvoices, getUnpaidInvoicesForPayments, getSupplierPaymentsWithInfo, getUnpaidSupplierInvoices } from "@/server/queries";
import { PaymentsPanel } from "@/components/payments-panel";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [customerPaymentsList, unpaidInvoices, supplierPaymentsList, unpaidSupplierInvoices] = await Promise.all([
    getCustomerPaymentsWithInvoices(),
    getUnpaidInvoicesForPayments(),
    getSupplierPaymentsWithInfo(),
    getUnpaidSupplierInvoices(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const totalAR = unpaidInvoices.reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);
  const overdueAR = unpaidInvoices
    .filter(inv => inv.dueDate && inv.dueDate < today)
    .reduce((s, inv) => s + inv.quantityTons * inv.sellPrice, 0);
  const totalCollected = customerPaymentsList.reduce((s, p) => s + p.amount, 0);
  const totalSupplierPaid = supplierPaymentsList.reduce((s, p) => s + p.amountUsd, 0);

  const isAP = tab === "supplier";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAP ? "Accounts Payable" : "Accounts Receivable"}</h1>
      </div>
      <PaymentsPanel
        customerPayments={customerPaymentsList}
        unpaidInvoices={unpaidInvoices}
        supplierPayments={supplierPaymentsList as any}
        unpaidSupplierInvoices={unpaidSupplierInvoices as any}
        totalAR={totalAR}
        overdueAR={overdueAR}
        totalCollected={totalCollected}
        totalSupplierPaid={totalSupplierPaid}
        defaultTab={tab === "supplier" ? "supplier" : "customer"}
      />
    </div>
  );
}
