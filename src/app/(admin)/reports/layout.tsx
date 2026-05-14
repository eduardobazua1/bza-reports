"use client";

import { usePathname } from "next/navigation";
import { ReportsTabs } from "@/components/reports-tabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTabs = pathname !== "/reports/client-report";

  return (
    <div className="space-y-6">
      {showTabs && <ReportsTabs />}
      {children}
    </div>
  );
}
