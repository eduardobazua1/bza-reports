"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiMutate } from "@/lib/api-mutate";

interface Tx {
  id: number;
  bankAccountId: number;
  transactionDate: string;
  amount: number;
  descriptionRaw: string;
  vendorName: string | null;
  category: string;
  subcategory: string | null;
  manuallyCategorized: boolean;
}

const CATEGORIES = [
  "Revenue", "COGS", "OpEx", "Capital", "Distribution",
  "Other Income", "Internal Transfer", "Uncategorized",
];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const catColor: Record<string, string> = {
  Revenue: "bg-emerald-100 text-emerald-800",
  COGS: "bg-rose-100 text-rose-800",
  OpEx: "bg-amber-100 text-amber-800",
  Capital: "bg-blue-100 text-blue-800",
  Distribution: "bg-purple-100 text-purple-800",
  "Other Income": "bg-teal-100 text-teal-800",
  "Internal Transfer": "bg-stone-100 text-stone-600",
  Uncategorized: "bg-red-100 text-red-700",
};

function TransactionsInner() {
  const params = useSearchParams();
  const accountId = params.get("accountId") || "";
  const initialCategory = params.get("category") || "";

  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [editing, setEditing] = useState<number | null>(null);
  const [editCat, setEditCat] = useState("");
  const [editSub, setEditSub] = useState("");

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (accountId) qs.set("accountId", accountId);
    if (categoryFilter) qs.set("category", categoryFilter);
    const res = await fetch(`/api/financial/transactions?${qs}`);
    setTxs(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [accountId, categoryFilter]);

  async function saveCategory(id: number) {
    try {
      await apiMutate("/api/financial/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, category: editCat, subcategory: editSub || null }),
      });
      setEditing(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save the category.");
    }
  }

  const totalIn = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Bank Transactions</h1>
        <p className="text-sm text-stone-500">Review and categorize imported transactions.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-stone-500">{txs.length} transactions</span>
        <span className="text-sm text-emerald-700">In: {usd(totalIn)}</span>
        <span className="text-sm text-rose-700">Out: {usd(totalOut)}</span>
      </div>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Subcategory</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-3 py-2 whitespace-nowrap text-stone-600">{t.transactionDate}</td>
                  <td className="px-3 py-2 text-stone-700 max-w-md truncate" title={t.descriptionRaw}>
                    {t.descriptionRaw}
                  </td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${t.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {usd(t.amount)}
                  </td>
                  {editing === t.id ? (
                    <>
                      <td className="px-3 py-2">
                        <select value={editCat} onChange={(e) => setEditCat(e.target.value)}
                          className="border border-stone-300 rounded px-2 py-1 text-xs">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={editSub} onChange={(e) => setEditSub(e.target.value)}
                          placeholder="subcategory" className="border border-stone-300 rounded px-2 py-1 text-xs w-32" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button onClick={() => saveCategory(t.id)} className="text-emerald-700 text-xs font-medium mr-2">Save</button>
                        <button onClick={() => setEditing(null)} className="text-stone-400 text-xs">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${catColor[t.category] || "bg-stone-100"}`}>
                          {t.category}
                        </span>
                        {t.manuallyCategorized && <span className="ml-1 text-xs text-stone-400" title="Manually categorized">✎</span>}
                      </td>
                      <td className="px-3 py-2 text-stone-500 text-xs">{t.subcategory || "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => { setEditing(t.id); setEditCat(t.category); setEditSub(t.subcategory || ""); }}
                          className="text-stone-400 hover:text-emerald-700 text-xs">Edit</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {txs.length === 0 && <p className="p-6 text-center text-stone-400">No transactions match.</p>}
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <TransactionsInner />
    </Suspense>
  );
}
