"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Loader2, ShieldCheck, AlertTriangle, Clock, FileWarning, FileText, Upload, Check } from "lucide-react";

type CustCert = {
  id: number; clientId: number; clientName: string; scheme: string;
  certificateNumber: string | null; certifier: string | null; issueDate: string | null;
  expiryDate: string | null; status: string; lastVerifiedAt: string | null; fileName: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  "Verified": "bg-emerald-100 text-emerald-700",
  "Verified (No Claim)": "bg-emerald-50 text-emerald-600",
  "Pending Customer Verification": "bg-amber-100 text-amber-700",
  "Review Required": "bg-red-100 text-red-700",
  "Document Missing": "bg-red-100 text-red-700",
};

export function CocAuditDashboard({ summary }: { summary: Record<string, number> }) {
  const [certs, setCerts] = useState<CustCert[]>([]);
  const [dl, setDl] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try { const r = await fetch("/api/customer-certs"); const d = await r.json(); if (Array.isArray(d)) setCerts(d); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function download(kind: "sales" | "audit" | "exceptions") {
    setDl(kind);
    try {
      const url = kind === "sales" ? "/api/audit-export" : kind === "audit" ? "/api/coc-audit" : "/api/audit-exceptions";
      const res = await fetch(url);
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] || "report.xlsx";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    } catch { alert("Could not generate the file."); }
    finally { setDl(null); }
  }

  function setCert(id: number, patch: Partial<CustCert>) {
    setCerts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  // Auto-save (on blur / select change) — no Save button.
  async function autoSave(c: CustCert) {
    try {
      await fetch("/api/customer-certs", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, certificateNumber: c.certificateNumber, certifier: c.certifier, expiryDate: c.expiryDate, status: c.status }),
      });
      setSaved(c.id); setTimeout(() => setSaved((s) => (s === c.id ? null : s)), 1500);
    } catch { /* ignore */ }
  }
  async function uploadPdf(c: CustCert, file: File) {
    setUploading(c.id);
    try {
      const fd = new FormData(); fd.append("id", String(c.id)); fd.append("file", file);
      const r = await fetch("/api/customer-certs", { method: "POST", body: fd });
      if (!r.ok) throw new Error();
      await load();
    } catch { alert("Could not upload the PDF."); }
    finally { setUploading(null); }
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const cards = [
    { key: "Verified", label: "Verified", icon: ShieldCheck, cls: "text-emerald-600 bg-emerald-50" },
    { key: "Verified (No Claim)", label: "Verified (No Claim)", icon: ShieldCheck, cls: "text-emerald-600 bg-emerald-50" },
    { key: "Pending Customer Verification", label: "Pending Customer", icon: Clock, cls: "text-amber-600 bg-amber-50" },
    { key: "Review Required", label: "Review Required", icon: AlertTriangle, cls: "text-red-600 bg-red-50" },
    { key: "Document Missing", label: "Document Missing", icon: FileWarning, cls: "text-red-600 bg-red-50" },
  ].filter((c) => summary[c.key]);

  return (
    <div className="space-y-4">
      {/* 1 — KPIs */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
        <p className="font-semibold text-stone-800">Audit KPIs</p>
        <p className="text-xs text-stone-400 mb-3">{total} operations validated end-to-end: Supplier docs → Input Claim → BZA → Customer → Output Claim.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {cards.map((c) => (
            <div key={c.key} className={`rounded-lg p-3 ${c.cls}`}>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold"><c.icon className="w-3.5 h-3.5" /> {c.label}</div>
              <div className="text-2xl font-bold mt-1">{summary[c.key]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Certification Master */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
        <p className="font-semibold text-stone-800">Customer Certification Master</p>
        <p className="text-xs text-stone-400 mb-3">BZA may only transfer an FSC/PEFC claim to a customer with a valid certificate. Set each customer&apos;s status to <strong>Valid</strong> to clear the &quot;Pending Customer&quot; operations.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-100">
                <th className="py-2 pr-2">Customer</th><th className="pr-2">Scheme</th><th className="pr-2">Certificate #</th>
                <th className="pr-2">Certifier</th><th className="pr-2">Expiry</th><th className="pr-2">Status</th><th className="pr-2">Certificate PDF</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-stone-50">
                  <td className="py-2 pr-2 font-medium text-stone-700 max-w-[180px] truncate" title={c.clientName}>
                    {c.clientName}{saved === c.id && <Check className="inline w-3 h-3 text-emerald-600 ml-1" />}
                  </td>
                  <td className="pr-2 uppercase">{c.scheme}</td>
                  <td className="pr-2"><input value={c.certificateNumber || ""} onChange={(e) => setCert(c.id, { certificateNumber: e.target.value })} onBlur={() => autoSave(c)}
                    className="w-32 border border-stone-200 rounded px-2 py-1" placeholder="FSC-C…" /></td>
                  <td className="pr-2"><input value={c.certifier || ""} onChange={(e) => setCert(c.id, { certifier: e.target.value })} onBlur={() => autoSave(c)}
                    className="w-28 border border-stone-200 rounded px-2 py-1" placeholder="Control Union" /></td>
                  <td className="pr-2"><input value={c.expiryDate || ""} onChange={(e) => setCert(c.id, { expiryDate: e.target.value })} onBlur={() => autoSave(c)}
                    className="w-24 border border-stone-200 rounded px-2 py-1" placeholder="2028-01-29" /></td>
                  <td className="pr-2">
                    <select value={c.status} onChange={(e) => { setCert(c.id, { status: e.target.value }); autoSave({ ...c, status: e.target.value }); }}
                      className={`border border-stone-200 rounded px-2 py-1 ${c.status === "valid" ? "text-emerald-700" : "text-amber-700"}`}>
                      <option value="pending">Pending</option><option value="valid">Valid</option>
                      <option value="expired">Expired</option><option value="suspended">Suspended</option>
                    </select>
                  </td>
                  <td className="pr-2">
                    <div className="flex items-center gap-2">
                      {c.fileName ? (
                        <a href={`/api/customer-certs?id=${c.id}&file=1`} target="_blank" rel="noopener noreferrer"
                          className="text-[#0d3d3b] hover:opacity-70" title={c.fileName}>
                          <FileText className="w-4 h-4" />
                        </a>
                      ) : <span className="text-stone-400">—</span>}
                      <input ref={(el) => { fileRefs.current[c.id] = el; }} type="file" accept="application/pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(c, f); e.target.value = ""; }} />
                      <button onClick={() => fileRefs.current[c.id]?.click()} disabled={uploading === c.id}
                        className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-[#0d3d3b] disabled:opacity-50" title="Upload PDF">
                        {uploading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 — Document generators */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
        <p className="font-semibold text-stone-800">Document generator</p>
        <p className="text-xs text-stone-400 mb-3">Generate the audit reports from the TMS.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download("sales")} disabled={dl !== null}
            className="flex items-center gap-1.5 text-xs font-semibold bg-[#0d3d3b] text-white rounded-lg px-3 py-2 hover:opacity-90 disabled:opacity-50">
            {dl === "sales" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Sales Aging Report
          </button>
          <button onClick={() => download("audit")} disabled={dl !== null}
            className="flex items-center gap-1.5 text-xs font-semibold border border-stone-200 text-stone-700 rounded-lg px-3 py-2 hover:bg-stone-50 disabled:opacity-50">
            {dl === "audit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#0d3d3b]" />} CoC Audit Validation Report
          </button>
          <button onClick={() => download("exceptions")} disabled={dl !== null}
            className="flex items-center gap-1.5 text-xs font-semibold border border-red-200 text-red-700 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-50">
            {dl === "exceptions" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Exception Report
          </button>
        </div>
      </div>
    </div>
  );
}
