import { getUnpaidInvoicesForPayments } from "@/server/queries";
import { FactoringCalculator, type FactoringRow } from "@/components/factoring-calculator";

export const dynamic = "force-dynamic";

// Kimberly-Clark is the only client enrolled in JP Morgan's Supply Chain Finance program.
function isKimberly(name: string | null) {
  return !!name && name.toLowerCase().includes("kimberly");
}

export default async function FactoringPage() {
  const invoices = await getUnpaidInvoicesForPayments();
  const kc = invoices.filter((inv) => isKimberly(inv.clientName));

  const rows: FactoringRow[] = kc
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      poNumber: inv.poNumber ?? null,
      amount: inv.quantityTons * inv.sellPrice,
      shipmentDate: inv.shipmentDate,
      dueDate: inv.dueDate,
    }))
    // furthest due date first (most expensive / most cash tied up)
    .sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? ""));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Factoring — JP Morgan</h1>
        <p className="text-sm text-stone-500 mt-1">
          Supply Chain Finance · Kimberly-Clark program. See what each open KC invoice costs to discount early, and how much cash you get today.
        </p>
      </div>
      <FactoringCalculator rows={rows} />
    </div>
  );
}
