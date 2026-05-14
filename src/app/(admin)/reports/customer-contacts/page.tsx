import { getClients } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "name", label: "Name", align: "left", format: "text" },
  { key: "contactName", label: "Contact", align: "left", format: "text" },
  { key: "contactEmail", label: "Email", align: "left", format: "text" },
  { key: "phone", label: "Phone", align: "left", format: "text" },
  { key: "city", label: "City", align: "left", format: "text" },
  { key: "country", label: "Country", align: "left", format: "text" },
  { key: "rfc", label: "RFC", align: "left", format: "text", defaultVisible: false },
];

export default async function CustomerContactsPage() {
  const clients = await getClients();

  const rows = clients.map((c) => ({
    name: c.name,
    contactName: c.contactName ?? "",
    contactEmail: c.contactEmail ?? "",
    phone: c.phone ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    rfc: c.rfc ?? "",
  }));

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="customer-contacts"
      title="Customer Contact List"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
    />
  );
}
