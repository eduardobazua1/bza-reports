"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, Link2, Unlink } from "lucide-react";
import { deleteContract, linkPoToContract, updateContract } from "@/server/actions";
import { formatDate, formatNumber, formatCurrency, contractStatusLabels, contractStatusColors, formatPriceFormula } from "@/lib/utils";
import { ContractForm } from "@/components/contract-form";

type Status = "draft" | "active" | "expired" | "cancelled";
type PriceType = "fixed" | "cost_plus" | "market_plus";
type Frequency = "total" | "monthly" | "quarterly";

type Contract = {
  id: number;
  contractNumber: string;
  clientId: number;
  supplierId: number;
  product?: string | null;
  status: Status;
  volumeTons?: number | null;
  volumeFrequency: Frequency;
  startDate?: string | null;
  endDate?: string | null;
  sellPriceType: PriceType;
  sellPrice?: number | null;
  sellMargin?: number | null;
  sellMarketRef?: string | null;
  sellIncoterm?: string | null;
  sellPaymentDays?: number | null;
  buyPriceType: PriceType;
  buyPrice?: number | null;
  buyMargin?: number | null;
  buyMarketRef?: string | null;
  buyIncoterm?: string | null;
  buyPaymentDays?: number | null;
  notes?: string | null;
  volumeUsed: number;
  client?: { id: number; name: string } | null;
  supplier?: { id: number; name: string } | null;
  purchaseOrders: Array<{
    po: {
      id: number;
      poNumber: string;
      poDate?: string | null;
      plannedTons: number;
      status: string;
      contractId?: number | null;
    };
    invoiceCount: number;
    shippedTons: number;
  }>;
};

type EligiblePo = { id: number; poNumber: string; product?: string | null; plannedTons: number; status: string };
type Client     = { id: number; name: string };
type Supplier   = { id: number; name: string };

type Props = {
  contract: Contract;
  clients: Client[];
  suppliers: Supplier[];
  eligiblePos: EligiblePo[];
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm text-stone-700">{value ?? <span className="text-stone-300">—</span>}</span>
    </div>
  );
}

export function ContractDetailActions({ contract, clients, suppliers, eligiblePos }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEdit,   setShowEdit]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLink,   setShowLink]   = useState(false);
  const [linkingPoId, setLinkingPoId] = useState<number | null>(null);

  const volPct = contract.volumeTons && contract.volumeTons > 0
    ? Math.min(100, (contract.volumeUsed / contract.volumeTons) * 100)
    : null;

  function handleDelete() {
    startTransition(async () => {
      await deleteContract(contract.id);
      router.push("/contracts");
    });
  }

  function handleStatusChange(status: Status) {
    startTransition(async () => {
      await updateContract(contract.id, { status });
      router.refresh();
    });
  }

  function handleUnlink(poId: number) {
    startTransition(async () => {
      await linkPoToContract(poId, null);
      router.refresh();
    });
  }

  function handleLink(poId: number) {
    startTransition(async () => {
      await linkPoToContract(poId, contract.id);
      setShowLink(false);
      setLinkingPoId(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* Header actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status selector */}
        <select
          value={contract.status}
          onChange={e => handleStatusChange(e.target.value as Status)}
          disabled={isPending}
          className={`text-xs px-3 py-1.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0d3d3b] ${contractStatusColors[contract.status]}`}
        >
          {(["draft","active","expired","cancelled"] as Status[]).map(s => (
            <option key={s} value={s}>{contractStatusLabels[s]}</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600"
        >
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-100 rounded-lg hover:bg-red-50 text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-stone-400 mb-1">Client</p>
          <p className="font-semibold text-stone-800">{contract.client?.name ?? "—"}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-stone-400 mb-1">Supplier</p>
          <p className="font-semibold text-stone-800">{contract.supplier?.name ?? "—"}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-stone-400 mb-1">Product</p>
          <p className="font-semibold text-stone-800">{contract.product ?? "—"}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-stone-400 mb-1">Validity</p>
          <p className="font-semibold text-stone-800 text-sm">
            {contract.startDate ? formatDate(contract.startDate) : "—"} → {contract.endDate ? formatDate(contract.endDate) : "—"}
          </p>
        </div>
      </div>

      {/* Price terms */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sell */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Client Terms (Sell)</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Price" value={formatPriceFormula(contract.sellPriceType, contract.sellPrice, contract.sellMargin, contract.sellMarketRef)} />
            <InfoRow label="Incoterm" value={contract.sellIncoterm} />
            <InfoRow label="Payment" value={contract.sellPaymentDays ? `Net ${contract.sellPaymentDays}` : null} />
            {contract.sellPriceType === "market_plus" && (
              <InfoRow label="Market Ref" value={contract.sellMarketRef} />
            )}
          </div>
        </div>

        {/* Buy */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Supplier Terms (Buy)</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Price" value={formatPriceFormula(contract.buyPriceType, contract.buyPrice, contract.buyMargin, contract.buyMarketRef)} />
            <InfoRow label="Incoterm" value={contract.buyIncoterm} />
            <InfoRow label="Payment" value={contract.buyPaymentDays ? `Net ${contract.buyPaymentDays}` : null} />
            {contract.buyPriceType === "market_plus" && (
              <InfoRow label="Market Ref" value={contract.buyMarketRef} />
            )}
          </div>
        </div>
      </div>

      {/* Volume progress */}
      {contract.volumeTons != null && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Volume · {contractStatusLabels[contract.volumeFrequency as string] ?? contract.volumeFrequency}
            </h3>
            <span className="text-sm font-semibold text-stone-700">
              {formatNumber(contract.volumeUsed, 0)} / {formatNumber(contract.volumeTons, 0)} t
              {volPct != null && <span className="ml-2 text-stone-400">({volPct.toFixed(1)}%)</span>}
            </span>
          </div>
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${volPct != null && volPct >= 100 ? "bg-emerald-500" : "bg-[#0d3d3b]"}`}
              style={{ width: `${volPct ?? 0}%` }}
            />
          </div>
          {contract.notes && (
            <p className="mt-3 text-sm text-stone-500 italic">{contract.notes}</p>
          )}
        </div>
      )}

      {/* Linked POs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800">Linked Purchase Orders</h3>
          {eligiblePos.length > 0 && (
            <button
              onClick={() => setShowLink(true)}
              className="flex items-center gap-1.5 text-xs text-[#0d3d3b] hover:underline font-medium"
            >
              <Link2 className="w-3.5 h-3.5" /> Link PO
            </button>
          )}
        </div>

        {contract.purchaseOrders.length === 0 ? (
          <div className="px-5 py-8 text-sm text-center text-stone-400">
            No purchase orders linked yet.{" "}
            {eligiblePos.length > 0 && (
              <button onClick={() => setShowLink(true)} className="text-[#0d3d3b] hover:underline">Link one now →</button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium text-stone-400 text-xs">PO #</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-xs">Date</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-400 text-xs">Planned TN</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-400 text-xs">Shipped TN</th>
                <th className="text-left px-4 py-2.5 font-medium text-stone-400 text-xs">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {contract.purchaseOrders.map(({ po, invoiceCount, shippedTons }) => (
                <tr key={po.id} className="hover:bg-stone-50">
                  <td className="px-5 py-2.5 font-medium">
                    <Link href={`/purchase-orders/${po.id}`} className="text-[#0d3d3b] hover:underline">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{formatDate(po.poDate)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatNumber(po.plannedTons, 1)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500">{formatNumber(shippedTons, 1)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      po.status === "active"    ? "bg-[#ccfbf1] text-[#0d3d3b]" :
                      po.status === "completed" ? "bg-stone-100 text-stone-500"  :
                      "bg-red-50 text-red-500"
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleUnlink(po.id)}
                      disabled={isPending}
                      title="Unlink from contract"
                      className="text-stone-300 hover:text-red-400 transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Link PO modal */}
      {showLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-semibold">Link Purchase Order</h3>
              <button onClick={() => setShowLink(false)} className="text-stone-400 hover:text-stone-600 text-lg leading-none">&times;</button>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
              {eligiblePos.length === 0 ? (
                <p className="text-sm text-stone-400">No eligible POs for this client/supplier combination.</p>
              ) : eligiblePos.map(po => (
                <button
                  key={po.id}
                  onClick={() => handleLink(po.id)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between px-4 py-3 border border-stone-200 rounded-lg hover:border-[#0d3d3b] hover:bg-[#0d3d3b]/5 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-stone-800">{po.poNumber}</p>
                    <p className="text-xs text-stone-400">{po.product} · {formatNumber(po.plannedTons, 1)} t</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${po.status === "active" ? "bg-[#ccfbf1] text-[#0d3d3b]" : "bg-stone-100 text-stone-500"}`}>
                    {po.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-stone-800 mb-2">Delete {contract.contractNumber}?</h3>
            <p className="text-sm text-stone-500 mb-5">This will unlink all associated POs. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleDelete} disabled={isPending} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                {isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      {showEdit && (
        <ContractForm
          clients={clients}
          suppliers={suppliers}
          nextContractNumber={contract.contractNumber}
          existing={contract}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
