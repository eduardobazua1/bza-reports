"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Loader2, FileText, Upload, Check } from "lucide-react";

type CustCert = {
  id: number; clientId: number; clientName: string; scheme: string;
  certificateNumber: string | null; certifier: string | null; issueDate: string | null;
  expiryDate: string | null; status: string; lastVerifiedAt: string | null; fileName: string | null;
};

export function CocAuditDashboard() {
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

  return (
    <div className="space-y-4">
      {/* Customer Certification Master */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4">
        <p className="font-semibold text-stone-800 mb-3">Customer Certification Master</p>
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
                    {c.clientName}{saved === c.id && <Check className="inline w-3 h-3 text-[#0d3d3b] ml-1" />}
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
                      className={`border border-stone-200 rounded px-2 py-1 ${c.status === "valid" ? "text-[#0d3d3b] font-semibold" : "text-stone-500"}`}>
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
        <p className="font-semibold text-stone-800 mb-3">Document generator</p>
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
            className="flex items-center gap-1.5 text-xs font-semibold border border-stone-200 text-stone-700 rounded-lg px-3 py-2 hover:bg-stone-50 disabled:opacity-50">
            {dl === "exceptions" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-[#0d3d3b]" />} Exception Report
          </button>
        </div>
      </div>
    </div>
  );
}
