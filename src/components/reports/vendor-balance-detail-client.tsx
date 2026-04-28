"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Payment = {
  id: number;
  paymentDate: string | null;
  poNumber: string | null;
  amountUsd: number | null;
  estimatedTons: number | null;
  actualTons: number | null;
  adjustmentAmount: number | null;
  adjustmentStatus: string | null;
  paymentMethod: string | null;
  reference: string | null;
};

type SupplierGroup = {
  name: string;
  payments: Payment[];
};

export function VendorBalanceDetailClient({
  supplierGroups,
  grandTotal,
}: {
  supplierGroups: SupplierGroup[];
  grandTotal: number;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function fmt(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  }

  function fmtAdjustment(amount: number | null) {
    if (amount === null || amount === 0) return <span className="text-stone-400">—</span>;
    if (amount > 0) return <span className="text-amber-600 font-medium">+{formatCurrency(amount)}</span>;
    return <span className="text-red-600 font-medium">-{formatCurrency(Math.abs(amount))}</span>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <th className="text-left px-6 py-3 w-32">Date</th>
            <th className="text-left px-4 py-3 w-28">PO</th>
            <th className="text-right px-4 py-3 w-32">Amount</th>
            <th className="text-right px-4 py-3 w-24">Est. Tons</th>
            <th className="text-right px-4 py-3 w-24">Actual Tons</th>
            <th className="text-right px-4 py-3 w-32">Adjustment</th>
            <th className="text-left px-4 py-3 w-28">Method</th>
            <th className="text-left px-6 py-3">Reference</th>
          </tr>
        </thead>
        <tbody>
          {supplierGroups.map(group => {
            const subtotal = group.payments.reduce((s, p) => s + (p.amountUsd ?? 0), 0);
            const isOpen = !collapsed[group.name];

            return [
              // Supplier header row
              <tr key={`hdr-${group.name}`}
                className="border-t border-stone-100 bg-stone-50 cursor-pointer select-none hover:bg-stone-100"
                onClick={() => setCollapsed(p => ({ ...p, [group.name]: !p[group.name] }))}>
                <td colSpan={8} className="px-6 py-2.5">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                      {group.name} ({group.payments.length})
                    </span>
                  </div>
                </td>
              </tr>,

              // Payment rows
              ...(isOpen ? group.payments.map((p, i) => (
                <tr key={`${group.name}-${i}`} className="border-t border-stone-50 hover:bg-stone-50">
                  <td className="px-6 py-2.5 text-stone-600">{fmt(p.paymentDate)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-[#0d3d3b]">{p.poNumber ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-800">{p.amountUsd != null ? formatCurrency(p.amountUsd) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600">{p.estimatedTons != null ? p.estimatedTons.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600">{p.actualTons != null ? p.actualTons.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5 text-right">{fmtAdjustment(p.adjustmentAmount)}</td>
                  <td className="px-4 py-2.5 text-stone-500 capitalize">{p.paymentMethod ?? "—"}</td>
                  <td className="px-6 py-2.5 text-stone-500">{p.reference ?? "—"}</td>
                </tr>
              )) : []),

              // Supplier subtotal
              ...(isOpen ? [
                <tr key={`sub-${group.name}`} className="border-t border-stone-200 bg-stone-50">
                  <td colSpan={2} className="px-6 py-2 text-xs font-semibold text-stone-500">
                    Total for {group.name}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-stone-800">{formatCurrency(subtotal)}</td>
                  <td colSpan={5} className="px-4 py-2" />
                </tr>
              ] : []),
            ];
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-stone-400">
            <td colSpan={2} className="px-6 py-3 text-sm font-bold text-stone-900 uppercase tracking-wide">TOTAL</td>
            <td className="px-4 py-3 text-right font-bold text-stone-900 text-base">{formatCurrency(grandTotal)}</td>
            <td colSpan={5} className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
