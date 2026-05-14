"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDate, formatNumber, contractStatusLabels, contractStatusColors, formatPriceFormula } from "@/lib/utils";
import { ContractForm } from "@/components/contract-form";
import type { getContracts, getClients, getSuppliers, getNextContractNumber } from "@/server/queries";

type ContractRow  = Awaited<ReturnType<typeof getContracts>>[number];
type Client       = Awaited<ReturnType<typeof getClients>>[number];
type Supplier     = Awaited<ReturnType<typeof getSuppliers>>[number];

const STATUS_FILTERS = ["all", "active", "draft", "expired", "cancelled"] as const;

type Props = {
  contracts: ContractRow[];
  clients: Client[];
  suppliers: Supplier[];
  nextContractNumber: string;
};

export function ContractsList({ contracts, clients, suppliers, nextContractNumber }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "expired" | "cancelled">("all");
  const [showForm, setShowForm] = useState(false);

  const filtered = filter === "all" ? contracts : contracts.filter(r => r.contract.status === filter);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Status tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                filter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : contractStatusLabels[s]}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {s === "all" ? contracts.length : contracts.filter(r => r.contract.status === s).length}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0d3d3b] text-white rounded-lg text-sm font-medium hover:bg-[#0a5c5a]"
        >
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {filter === "all" ? "No contracts yet. Create your first one." : `No ${contractStatusLabels[filter].toLowerCase()} contracts.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Contract #</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Sell</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Buy</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Volume</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Validity</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">POs</th>
                  <th className="text-left px-4 py-3 font-medium text-stone-500 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(row => {
                  const c = row.contract;
                  const volPct = c.volumeTons && c.volumeTons > 0
                    ? Math.min(100, (row.volumeUsed / c.volumeTons) * 100)
                    : null;
                  return (
                    <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/contracts/${c.id}`} className="text-[#0d3d3b] hover:underline">
                          {c.contractNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{row.clientName ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-500">{row.supplierName ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{c.product ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                        {formatPriceFormula(c.sellPriceType, c.sellPrice, c.sellMargin, c.sellMarketRef)}
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                        {formatPriceFormula(c.buyPriceType, c.buyPrice, c.buyMargin, c.buyMarketRef)}
                      </td>
                      <td className="px-4 py-3">
                        {c.volumeTons ? (
                          <div className="min-w-[100px]">
                            <div className="flex justify-between text-xs text-stone-500 mb-0.5">
                              <span>{formatNumber(row.volumeUsed, 0)} / {formatNumber(c.volumeTons, 0)} t</span>
                              {volPct != null && <span>{volPct.toFixed(0)}%</span>}
                            </div>
                            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#0d3d3b] rounded-full" style={{ width: `${volPct ?? 0}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs">
                        {c.startDate || c.endDate
                          ? <>{formatDate(c.startDate)} → {formatDate(c.endDate)}</>
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-600">{row.poCount}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contractStatusColors[c.status]}`}>
                          {contractStatusLabels[c.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ContractForm
          clients={clients}
          suppliers={suppliers}
          nextContractNumber={nextContractNumber}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  );
}
