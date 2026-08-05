"use client";

import { usePathname } from "next/navigation";
import { ReportsTabs } from "@/components/reports-tabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const noTabs = ["/reports/client-report", "/reports/audit-export"];
  const showTabs = !noTabs.includes(pathname);

  return (
    <div className="space-y-6">
      {showTabs && <ReportsTabs />}
      {children}
    </div>
  );
}
