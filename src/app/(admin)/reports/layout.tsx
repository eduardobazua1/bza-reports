import { ReportsTabs } from "@/components/reports-tabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ReportsTabs />
      {children}
    </div>
  );
}
