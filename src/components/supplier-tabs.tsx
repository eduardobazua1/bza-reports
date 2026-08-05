"use client";

import { useState, type ReactNode } from "react";

type TabKey = "overview" | "activity" | "profile";

export function SupplierTabs({
  overview,
  activity,
  profile,
}: {
  overview: ReactNode;
  activity: ReactNode;
  profile: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
    { key: "profile", label: "Profile" },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "text-[#0d3d3b]"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#0d3d3b] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-5">
        {tab === "overview" && overview}
        {tab === "activity" && activity}
        {tab === "profile" && profile}
      </div>
    </div>
  );
}
