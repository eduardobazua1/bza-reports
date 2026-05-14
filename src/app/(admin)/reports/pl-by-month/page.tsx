import { getInvoices } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "month", label: "Month", align: "left", format: "text" },
  { key: "revenue", label: "Revenue", align: "right", format: "currency" },
  { key: "cost", label: "Cost", align: "right", format: "currency", defaultVisible: false },
  { key: "profit", label: "Gross Profit", align: "right", format: "currency" },
  { key: "margin", label: "Margin %", align: "right", format: "percent" },
];

export default async function PLByMonthPage() {
  const allInvoices = await getInvoices();

  const byMonth: Record<string, { revenue: number; cost: number }> = {};

  for (const row of allInvoices) {
    const date = row.invoice.shipmentDate;
    if (!date) continue;
    const monthKey = date.slice(0, 7);
    const qty = row.invoice.quantityTons ?? 0;
    const sell = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buy = row.invoice.buyPriceOverride ?? row.poBuyPrice ?? 0;
    if (!byMonth[monthKey]) byMonth[monthKey] = { revenue: 0, cost: 0 };
    byMonth[monthKey].revenue += qty * sell;
    byMonth[monthKey].cost += qty * buy;
  }

  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => {
      const [year, mon] = monthKey.split("-");
      const label = new Date(parseInt(year), parseInt(mon) - 1, 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
      const profit = data.revenue - data.cost;
      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
      return {
        month: label,
        revenue: data.revenue,
        cost: data.cost,
        profit,
        margin,
      };
    });

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.revenue as number),
      cost: acc.cost + (r.cost as number),
      profit: acc.profit + (r.profit as number),
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="pl-by-month"
      title="Profit & Loss by Month"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ revenue: totals.revenue, cost: totals.cost, profit: totals.profit }}
      totalsLabel="TOTAL"
    />
  );
}
