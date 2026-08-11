"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

type Setup = { qrDataUrl: string; secret: string };

// Self-service two-factor (TOTP) enrollment card for the Settings page.
export function MfaCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  async function loadStatus() {
    try {
      const r = await fetch("/api/mfa/status");
      const d = await r.json();
      setEnabled(!!d.enabled);
    } catch { setEnabled(false); }
  }
  useEffect(() => { loadStatus(); }, []);

  async function startSetup() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/mfa/setup", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't start setup.");
      setSetup({ qrDataUrl: d.qrDataUrl, secret: d.secret });
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function confirmEnable() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/mfa/enable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't verify the code.");
      setSetup(null); setCode(""); setEnabled(true);
      setMsg("Two-factor authentication is now on. You'll enter a code at each sign-in.");
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function confirmDisable() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/mfa/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't disable MFA.");
      setEnabled(false); setDisabling(false); setCode("");
      setMsg("Two-factor authentication has been turned off.");
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-[#0d3d3b] mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-stone-400 mt-0.5" />
          )}
          <div>
            <h3 className="font-semibold text-stone-800">Two-Factor Authentication (MFA)</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Add a one-time code from an authenticator app (Google Authenticator, Authy) on top of your password.
            </p>
          </div>
        </div>
        {enabled !== null && (
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            enabled ? "bg-[#e6f1ee] text-[#0d3d3b]" : "bg-stone-100 text-stone-500"
          }`}>
            {enabled ? "On" : "Off"}
          </span>
        )}
      </div>

      {enabled === null ? (
        <p className="text-sm text-stone-400 mt-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : enabled ? (
        <div className="mt-4">
          {!disabling ? (
            <button onClick={() => { setDisabling(true); setMsg(null); }}
              className="text-sm text-stone-600 border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50">
              Turn off MFA
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6} inputMode="numeric" placeholder="Current code"
                className="w-32 border border-stone-300 rounded-lg px-3 py-1.5 text-center tracking-widest" />
              <button onClick={confirmDisable} disabled={busy || code.length !== 6}
                className="text-sm bg-stone-800 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                Confirm turn off
              </button>
              <button onClick={() => { setDisabling(false); setCode(""); }} className="text-sm text-stone-400 hover:text-stone-600">Cancel</button>
            </div>
          )}
        </div>
      ) : setup ? (
        <div className="mt-4 grid sm:grid-cols-[auto,1fr] gap-5 items-start">
          <div className="bg-white border border-stone-200 rounded-lg p-2 w-fit">
            <Image src={setup.qrDataUrl} alt="MFA QR code" width={200} height={200} unoptimized />
          </div>
          <div className="space-y-3">
            <ol className="text-sm text-stone-600 list-decimal list-inside space-y-1">
              <li>Open your authenticator app and scan this QR code.</li>
              <li>Or enter this key manually:
                <code className="block mt-1 text-xs bg-stone-100 rounded px-2 py-1 break-all">{setup.secret}</code>
              </li>
              <li>Enter the 6-digit code it shows to confirm.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6} inputMode="numeric" placeholder="000000" autoFocus
                className="w-32 border border-stone-300 rounded-lg px-3 py-2 text-center tracking-widest" />
              <button onClick={confirmEnable} disabled={busy || code.length !== 6}
                className="text-sm bg-[#0d3d3b] text-white rounded-lg px-4 py-2 disabled:opacity-50">
                {busy ? "Verifying…" : "Verify & enable"}
              </button>
              <button onClick={() => { setSetup(null); setCode(""); }} className="text-sm text-stone-400 hover:text-stone-600">Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <button onClick={startSetup} disabled={busy}
            className="text-sm bg-[#0d3d3b] text-white rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enable two-factor authentication
          </button>
        </div>
      )}

      {msg && <p className="text-sm text-stone-600 mt-3">{msg}</p>}
    </div>
  );
}
