import { getProfitByClient } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

const COLUMNS: ColDef[] = [
  { key: "client", label: "Client", align: "left", format: "text" },
  { key: "revenue", label: "Revenue", align: "right", format: "currency" },
  { key: "tons", label: "Tons", align: "right", format: "number" },
];

export default async function IncomeByCustomerPage() {
  const clients = await getProfitByClient();

  const rows = [...clients]
    .sort((a, b) => b.revenue - a.revenue)
    .map((c) => ({
      client: c.client,
      revenue: c.revenue,
      tons: c.tons,
    }));

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue as number), 0);
  const totalTons = rows.reduce((s, r) => s + (r.tons as number), 0);

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="income-by-customer"
      title="Income by Customer"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
      totals={{ revenue: totalRevenue, tons: totalTons }}
      totalsLabel="TOTAL"
    />
  );
}
