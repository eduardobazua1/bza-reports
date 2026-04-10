"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/reports", label: "KPIs" },
  { href: "/reports/shipments", label: "Active Shipments" },
  { href: "/reports/monthly", label: "Monthly" },
  { href: "/reports/financial", label: "Financial Reports" },
  { href: "/reports/schedule", label: "Schedule Reports" },
];

export function ReportsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
