"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { Landmark, RefreshCw, Loader2 } from "lucide-react";

// "Connect bank" (Plaid Link) + "Sync now" for the Financials page.
export function PlaidConnect() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(async (public_token, metadata) => {
    setBusy(true); setMsg("Connecting bank…");
    try {
      const r = await fetch("/api/plaid/exchange", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, institution: metadata?.institution?.name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not connect the bank.");
      setMsg("Importing transactions…");
      const s = await fetch("/api/plaid/sync", { method: "POST" });
      const sd = await s.json();
      setMsg(`Connected ${d.accounts} account(s) · imported ${sd.added ?? 0} transactions.`);
      setTimeout(() => location.reload(), 1600);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  // Launch the widget once we have a token and Link is ready.
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  async function connect() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/plaid/link-token", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Plaid is not configured yet.");
      setLinkToken(d.link_token);
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  }

  async function sync() {
    setBusy(true); setMsg("Syncing…");
    try {
      const s = await fetch("/api/plaid/sync", { method: "POST" });
      const sd = await s.json();
      if (!s.ok) throw new Error(typeof sd.error === "string" ? sd.error : "Sync failed.");
      setMsg(`Imported ${sd.added ?? 0} new transaction(s).`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={connect} disabled={busy}
        className="flex items-center gap-1.5 text-xs font-semibold bg-[#0d3d3b] text-white rounded-lg px-3 py-2 hover:opacity-90 disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />} Connect bank
      </button>
      <button onClick={sync} disabled={busy}
        className="flex items-center gap-1.5 text-xs font-semibold border border-stone-200 text-stone-700 rounded-lg px-3 py-2 hover:bg-stone-50 disabled:opacity-50">
        <RefreshCw className="w-3.5 h-3.5 text-[#0d3d3b]" /> Sync now
      </button>
      {msg && <span className="text-xs text-stone-500">{msg}</span>}
    </div>
  );
}
