"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiMutate } from "@/lib/api-mutate";
import { PlaidConnect } from "@/components/plaid-connect";
import { Receipt, Upload } from "lucide-react";

interface BankAccount {
  id: number;
  name: string;
  bank: string;
  accountNumberMasked: string;
  accountType: string;
  currency: string;
  openingBalance: number;
  openingDate: string;
  isActive: boolean;
  currentBalance: number;
}

interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  uncategorized: number;
  categoryBreakdown: Record<string, number>;
  parseErrors: string[];
  accountNumbersInFile: string[];
}

const usdc = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const isReserve = (t: string) => t === "money_market" || t === "savings";

export default function FinancialsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [asOf, setAsOf] = useState<string>(today());

  const [form, setForm] = useState({
    name: "", bank: "Vantage Bank Texas", accountNumberMasked: "",
    accountType: "checking", openingBalance: "0", openingDate: "",
  });

  async function load(date = asOf) {
    setLoading(true);
    const res = await fetch(`/api/financial/bank-accounts?asOf=${date}`);
    setAccounts(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(asOf); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [asOf]);

  const totalCash = accounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const isToday = asOf === today();

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiMutate("/api/financial/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) }),
      });
      setShowForm(false);
      setForm({ name: "", bank: "Vantage Bank Texas", accountNumberMasked: "", accountType: "checking", openingBalance: "0", openingDate: "" });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't create the account.");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>, accountId: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setSelectedAccount(accountId);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bankAccountId", String(accountId));
    const res = await fetch("/api/financial/bank-import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data);
    setImporting(false);
    e.target.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Bank Accounts</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PlaidConnect />
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-2 border border-stone-200 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50"
          >
            {showForm ? "Cancel" : "+ Add manually"}
          </button>
        </div>
      </div>

      {!loading && accounts.length > 0 && (
        <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: "linear-gradient(155deg, #12514e, #082826)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Total cash {isToday ? "on hand" : `as of ${asOf}`}</p>
              <p className="text-4xl font-extrabold tracking-tight tabular-nums mt-1">{usdc(totalCash)}</p>
              <p className="text-xs text-white/70 mt-1">{accounts.length} account{accounts.length > 1 ? "s" : ""} · {accounts[0]?.bank}</p>
            </div>
            <label className="text-[11px] text-white/70">
              <span className="block mb-1 font-semibold uppercase tracking-wider">Balance as of</span>
              <input type="date" value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value || today())}
                className="bg-white/10 border border-white/25 rounded-lg px-3 py-1.5 text-sm text-white [color-scheme:dark]" />
              {!isToday && <button onClick={() => setAsOf(today())} className="block mt-1 text-white/80 underline">← back to today</button>}
            </label>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={createAccount} className="bg-white rounded-xl border border-stone-200 p-5 grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="text-stone-600">Account Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Vantage Business Checking" className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Bank</span>
            <input required value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Account # (masked)</span>
            <input required value={form.accountNumberMasked} onChange={(e) => setForm({ ...form, accountNumberMasked: e.target.value })}
              placeholder="XXX45161" className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Type</span>
            <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2">
              <option value="checking">Checking</option>
              <option value="money_market">Money Market</option>
              <option value="savings">Savings</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Opening Balance (USD)</span>
            <input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-stone-600">Opening Date</span>
            <input type="date" required value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
              className="mt-1 w-full border border-stone-300 rounded-lg px-3 py-2" />
          </label>
          <div className="col-span-2">
            <button type="submit" className="px-4 py-2 bg-[#0d3d3b] text-white rounded-lg text-sm font-medium hover:bg-[#0d3d3b]">
              Create Account
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          No bank accounts yet. Add your Vantage Checking (#XXX45161) and Money Market (#XXX45069) to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...accounts].sort((x, y) => (isReserve(x.accountType) ? 1 : 0) - (isReserve(y.accountType) ? 1 : 0)).map((a) => {
            const reserve = isReserve(a.accountType);
            return (
              <div key={a.id} className="relative bg-white rounded-2xl border border-stone-200 shadow-sm p-5 overflow-hidden">
                <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: reserve ? "#2f8a80" : "#0d3d3b" }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-800 truncate">{a.name}</div>
                    <div className="text-xs text-stone-400">{a.bank} · {a.accountNumberMasked}</div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                    style={{ background: reserve ? "#c2e0da" : "#e6f1ee", color: reserve ? "#082826" : "#0d3d3b" }}>
                    {reserve ? "Reserve" : "Operating"}
                  </span>
                </div>
                <div className="mt-3 text-3xl font-extrabold tabular-nums text-[#0d3d3b]">{usdc(a.currentBalance)}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">{isToday ? "current balance" : `balance as of ${asOf}`} · {a.accountType.replace("_", " ")} · opened {a.openingDate}</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href={`/financials/transactions?accountId=${a.id}`}
                    className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0d3d3b] border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors">
                    <Receipt className="w-4 h-4" /> Transactions
                  </Link>
                  <label className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0d3d3b] border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" /> Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport(e, a.id)} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {importing && <p className="text-stone-500">Importing & categorizing…</p>}

      {importResult && (
        <div className="bg-white rounded-xl border border-[#0d3d3b]/20 p-5">
          <h3 className="font-semibold text-stone-800 mb-2">Import Result {selectedAccount && `(account #${selectedAccount})`}</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-stone-500">Imported:</span> <b>{importResult.imported}</b></div>
            <div><span className="text-stone-500">Skipped (dupes):</span> <b>{importResult.skippedDuplicates}</b></div>
            <div><span className="text-stone-500">Uncategorized:</span> <b className={importResult.uncategorized > 0 ? "text-stone-600" : ""}>{importResult.uncategorized}</b></div>
          </div>
          <div className="mt-3 text-sm">
            <span className="text-stone-500">By category:</span>{" "}
            {Object.entries(importResult.categoryBreakdown).map(([k, v]) => (
              <span key={k} className="inline-block mr-3">{k}: <b>{v}</b></span>
            ))}
          </div>
          {importResult.uncategorized > 0 && (
            <p className="mt-3 text-sm text-stone-700">
              {importResult.uncategorized} transactions need manual categorization.{" "}
              <Link href={`/financials/transactions?accountId=${selectedAccount}&category=Uncategorized`} className="underline">Review them →</Link>
            </p>
          )}
          {importResult.parseErrors.length > 0 && (
            <details className="mt-3 text-xs text-stone-400">
              <summary>{importResult.parseErrors.length} parse warnings</summary>
              <ul className="mt-1 list-disc list-inside">
                {importResult.parseErrors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
