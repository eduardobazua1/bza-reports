import { getProfitByClient } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "client", label: "Client", align: "left", format: "text" },
  { key: "revenue", label: "Revenue", align: "right", format: "currency" },
  { key: "cost", label: "Cost", align: "right", format: "currency", defaultVisible: false },
  { key: "profit", label: "Gross Profit", align: "right", format: "currency" },
  { key: "margin", label: "Margin %", align: "right", format: "percent" },
  { key: "tons", label: "Tons", align: "right", format: "number" },
];

export default async function PLByCustomerPage() {
  const clients = await getProfitByClient();

  const rows = [...clients]
    .sort((a, b) => b.revenue - a.revenue)
    .map((c) => ({
      client: c.client,
      revenue: c.revenue,
      cost: c.cost,
      profit: c.profit,
      margin: c.margin,
      tons: c.tons,
    }));

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.revenue as number),
      cost: acc.cost + (r.cost as number),
      profit: acc.profit + (r.profit as number),
      tons: acc.tons + (r.tons as number),
    }),
    { revenue: 0, cost: 0, profit: 0, tons: 0 }
  );

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="pl-by-customer"
      title="Profit & Loss by Customer"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ revenue: totals.revenue, cost: totals.cost, profit: totals.profit, tons: totals.tons }}
      totalsLabel="TOTAL"
    />
  );
}
