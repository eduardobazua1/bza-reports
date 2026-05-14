import { getInvoices } from "@/server/queries";
import { FinancialReports } from "@/components/financial-reports";

export const dynamic = "force-dynamic";

export default async function FinancialReportsPage() {
  const rows = await getInvoices();

  const data = rows.map((row) => {
    const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice = row.invoice.buyPriceOverride ?? row.poBuyPrice ?? 0;
    const revenue = row.invoice.quantityTons * sellPrice;
    const costNoFreight = row.invoice.quantityTons * buyPrice;
    const freight = row.invoice.freightCost ?? 0;
    const cost = costNoFreight + freight;
    const profit = revenue - cost;

    // Compute due date
    const terms = row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays
      : (row.clientPaymentTermsDays ?? 60);
    const base = row.invoice.invoiceDate || row.invoice.shipmentDate;
    let dueDate: string | null = null;
    if (base) {
      const d = new Date(base + "T12:00:00");
      d.setDate(d.getDate() + terms);
      dueDate = d.toISOString().split("T")[0];
    }

    const transport =
      row.transportType === "ffcc" ? "Railroad" :
      row.transportType === "ship" ? "Maritime" :
      row.transportType === "truck" ? "Truck" : "Other";

    return {
      invoiceNumber: row.invoice.invoiceNumber,
      clientName: row.clientName ?? "Unknown",
      supplierName: row.supplierName ?? "Unknown",
      poNumber: row.poNumber ?? "",
      invoiceDate: row.invoice.invoiceDate,
      shipmentDate: row.invoice.shipmentDate,
      dueDate,
      quantityTons: row.invoice.quantityTons,
      sellPrice,
      buyPrice,
      revenue,
      costNoFreight,
      freight,
      cost,
      profit,
      customerPaymentStatus: row.invoice.customerPaymentStatus,
      supplierPaymentStatus: row.invoice.supplierPaymentStatus,
      shipmentStatus: row.invoice.shipmentStatus,
      destination: row.invoice.destination,
      product: row.invoice.item ?? row.product,
      transportType: transport,
    };
  });

  return <FinancialReports data={data} />;
}
