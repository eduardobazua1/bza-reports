import { getSuppliers } from "@/server/queries";
import { ReportWrapper, type ColDef } from "@/components/reports/report-wrapper";

export const dynamic = "force-dynamic";

const COLUMNS: ColDef[] = [
  { key: "name", label: "Name", align: "left", format: "text" },
  { key: "contactName", label: "Contact", align: "left", format: "text" },
  { key: "contactEmail", label: "Email", align: "left", format: "text" },
  { key: "phone", label: "Phone", align: "left", format: "text" },
  { key: "country", label: "Country", align: "left", format: "text" },
  { key: "city", label: "City", align: "left", format: "text" },
];

export default async function VendorContactsPage() {
  const suppliers = await getSuppliers();

  const rows = suppliers.map((s) => ({
    name: s.name,
    contactName: s.contactName ?? "",
    contactEmail: s.contactEmail ?? "",
    phone: s.phone ?? "",
    country: s.country ?? "",
    city: s.city ?? "",
  }));

  const dateLabel =
    "As of " +
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <ReportWrapper
      reportId="vendor-contacts"
      title="Vendor Contact List"
      subtitle="BZA International Services"
      dateLabel={dateLabel}
      columns={COLUMNS}
      rows={rows}
    />
  );
}
