import { AuditPackage } from "@/components/audit-package";
import { CocAuditDashboard } from "@/components/coc-audit-dashboard";
import { getValidationSummary } from "@/lib/coc-audit";

export const dynamic = "force-dynamic";

export default async function AuditExportPage() {
  const summary = await getValidationSummary();

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-stone-900">FSC / PEFC Audit Package</h1>
      {/* KPIs → Customer Certification Master → Document generators */}
      <CocAuditDashboard summary={summary} />
      {/* Attachments */}
      <AuditPackage />
    </div>
  );
}
