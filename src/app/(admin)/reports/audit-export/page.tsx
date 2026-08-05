import { AuditPackage } from "@/components/audit-package";
import { CocAuditDashboard } from "@/components/coc-audit-dashboard";
import { AuditReadiness } from "@/components/audit-readiness";
import { getReadinessRows } from "@/lib/coc-audit";

export const dynamic = "force-dynamic";

export default async function AuditExportPage() {
  const readiness = await getReadinessRows();

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-stone-900">FSC / PEFC Audit Package</h1>
      {/* 1 — Readiness (single set of KPIs + per-operation semaphore) */}
      <AuditReadiness rows={readiness} />
      {/* 2 — Customer Certification Master + report generators */}
      <CocAuditDashboard />
      {/* 3 — Documents (attachments) at the bottom */}
      <AuditPackage />
    </div>
  );
}
