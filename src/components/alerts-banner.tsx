"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import type { AlertGroup } from "@/lib/alerts";

const ICON: Record<string, typeof Bell> = { overdue: AlertTriangle, certs: ShieldAlert, stale: Clock };

export function AlertsBanner({ groups, total }: { groups: AlertGroup[]; total: number }) {
  const [open, setOpen] = useState<string | null>(groups.find((g) => g.severity === "high")?.key ?? null);
  if (total === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
        <Bell className="w-4 h-4 text-[#0d3d3b]" />
        <span className="text-sm font-semibold text-stone-800">{total} alert{total === 1 ? "" : "s"} need attention</span>
      </div>
      <div className="divide-y divide-stone-50">
        {groups.map((g) => {
          const Icon = ICON[g.key] ?? Bell;
          const isOpen = open === g.key;
          const accent = g.severity === "high" ? "text-[#0d3d3b]" : "text-stone-500";
          return (
            <div key={g.key}>
              <button onClick={() => setOpen(isOpen ? null : g.key)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 text-left">
                <Icon className={`w-4 h-4 ${accent} shrink-0`} />
                <span className="text-sm font-medium text-stone-700">{g.title}</span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${g.severity === "high" ? "bg-[#0d3d3b] text-white" : "bg-stone-100 text-stone-600"}`}>{g.count}</span>
                <Link href={g.href} className="ml-auto text-[11px] text-[#0d3d3b] hover:underline shrink-0" onClick={(e) => e.stopPropagation()}>View all →</Link>
                <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-2.5 space-y-1">
                  {g.items.map((it, i) => (
                    <Link key={i} href={it.href} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-stone-50">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-700 truncate">{it.label}</p>
                        {it.sub && <p className="text-[11px] text-stone-400 truncate">{it.sub}</p>}
                      </div>
                      {it.value && <span className="ml-auto text-xs font-bold text-stone-700 tabular-nums shrink-0">{it.value}</span>}
                    </Link>
                  ))}
                  {g.count > g.items.length && <p className="text-[11px] text-stone-400 pl-4 pt-1">+{g.count - g.items.length} more…</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
