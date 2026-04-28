"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Row = {
  date: string | null;
  num: string;
  supplier: string;
  amount: number;
  daysSince: number;
};

type Bucket = { key: string; label: string; order: number; rows: Row[] };

export function APAgingDetailClient({ buckets, total, filterBucket, filterSupplier }: {
  buckets: Bucket[];
  total: number;
  filterBucket?: string;
  filterSupplier?: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const active = buckets.filter(b =>
    b.rows.length > 0 &&
    (!filterBucket || b.key === filterBucket)
  );

  function fmt(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <th className="text-left px-6 py-3 w-32">Date</th>
            <th className="text-left px-4 py-3 w-24">Type</th>
            <th className="text-left px-4 py-3 w-32">Invoice</th>
            <th className="text-left px-4 py-3">Supplier</th>
            <th className="text-right px-4 py-3 w-32">Amount</th>
            <th className="text-right px-4 py-3 w-32">Open Balance</th>
            <th className="text-right px-6 py-3 w-24">Days</th>
          </tr>
        </thead>
        <tbody>
          {active.map(bucket => {
            const bucketRows = filterSupplier
              ? bucket.rows.filter(r => r.supplier.toLowerCase().includes(filterSupplier.toLowerCase()))
              : bucket.rows;
            if (bucketRows.length === 0) return null;

            const bucketTotal = bucketRows.reduce((s, r) => s + r.amount, 0);
            const isOpen = !collapsed[bucket.key];

            return [
              // Bucket header row
              <tr key={`hdr-${bucket.key}`}
                className="border-t border-stone-100 bg-stone-50 cursor-pointer select-none hover:bg-stone-100"
                onClick={() => setCollapsed(p => ({ ...p, [bucket.key]: !p[bucket.key] }))}>
                <td colSpan={7} className="px-6 py-2.5">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                      {bucket.label} ({bucketRows.length})
                    </span>
                  </div>
                </td>
              </tr>,

              // Invoice rows
              ...(isOpen ? bucketRows.map((row, i) => (
                <tr key={`${bucket.key}-${i}`} className="border-t border-stone-50 hover:bg-stone-50">
                  <td className="px-6 py-2.5 text-stone-600">{fmt(row.date)}</td>
                  <td className="px-4 py-2.5 text-stone-500">Invoice</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{row.num}</td>
                  <td className="px-4 py-2.5 text-stone-700">{row.supplier}</td>
                  <td className="px-4 py-2.5 text-right text-stone-700">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-800">{formatCurrency(row.amount)}</td>
                  <td className={`px-6 py-2.5 text-right font-medium ${row.daysSince > 90 ? "text-red-600" : row.daysSince > 60 ? "text-amber-600" : row.daysSince > 30 ? "text-stone-600" : "text-stone-400"}`}>
                    {row.daysSince <= 0 ? "—" : row.daysSince}
                  </td>
                </tr>
              )) : []),

              // Bucket subtotal
              ...(isOpen ? [
                <tr key={`sub-${bucket.key}`} className="border-t border-stone-200 bg-stone-50">
                  <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-stone-500">
                    Total for {bucket.label}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-stone-800">{formatCurrency(bucketTotal)}</td>
                  <td className="px-4 py-2 text-right font-bold text-stone-800">{formatCurrency(bucketTotal)}</td>
                  <td className="px-6 py-2" />
                </tr>
              ] : []),
            ];
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-stone-400">
            <td colSpan={4} className="px-6 py-3 text-sm font-bold text-stone-900 uppercase tracking-wide">TOTAL</td>
            <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(total)}</td>
            <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(total)}</td>
            <td className="px-6 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
