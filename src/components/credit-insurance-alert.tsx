import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { CreditInsuranceData } from "@/server/credit-insurance";

// Count-chips card for the dashboard — uniform BZA-teal chips, each clickable into the module.
export function CreditInsuranceAlert({ data }: { data: CreditInsuranceData }) {
  const c = data.counts;

  const chips: { n: number; label: string }[] = [
    { n: c.toReport, label: "to report" },
    { n: c.approaching, label: "approaching 60d" },
    { n: c.overdue, label: "overdue" },
    { n: c.buyersOverLimit, label: "over limit" },
  ];
  const chipCls = (n: number) =>
    n === 0
      ? "bg-stone-100 text-stone-400 border-stone-200"
      : "bg-[#0d3d3b]/10 text-[#0d3d3b] border-[#0d3d3b]/25 hover:bg-[#0d3d3b]/20";

  return (
    <div className="bg-white border-l-[3px] border-l-[#0d3d3b] rounded-md shadow-sm p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/credit-insurance" className="text-xs font-bold uppercase tracking-wider text-stone-500 hover:text-[#0d3d3b] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#0d3d3b]" />
          Credit Insurance
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((ch) => (
            <Link
              key={ch.label}
              href="/credit-insurance"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${chipCls(ch.n)}`}
            >
              <b className="tabular-nums">{ch.n}</b> {ch.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
