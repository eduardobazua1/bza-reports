"use client";

import { useState, useRef } from "react";
import { apiMutate } from "@/lib/api-mutate";
import { Award, Upload, Download, Trash2, Plus, X, FileText, CheckCircle, AlertCircle, Clock } from "lucide-react";

type Cert = {
  id: number;
  name: string;
  certType: string;
  certCode: string | null;
  issuedBy: string | null;
  issuedTo: string | null;
  validFrom: string | null;
  validUntil: string | null;
  standard: string | null;
  notes: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
};

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  fsc:   { bg: "bg-[#e6f1ee]",  text: "text-[#0d3d3b]",  label: "FSC" },
  pefc:  { bg: "bg-[#e6f1ee]",text: "text-[#0d3d3b]",label: "PEFC" },
  other: { bg: "bg-stone-100",  text: "text-stone-600",  label: "Other" },
};

function certStatus(validUntil: string | null): "valid" | "expiring" | "expired" | "unknown" {
  if (!validUntil) return "unknown";
  const exp = new Date(validUntil);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return "expired";
  if (diff < 180) return "expiring";
  return "valid";
}

const STATUS_CONFIG = {
  valid:    { icon: CheckCircle,  color: "text-[#0d3d3b]",  bg: "bg-[#e6f1ee]",   label: "Valid" },
  expiring: { icon: Clock,        color: "text-stone-600",  bg: "bg-stone-50",   label: "Expiring soon" },
  expired:  { icon: AlertCircle,  color: "text-stone-600",    bg: "bg-stone-50",     label: "Expired" },
  unknown:  { icon: FileText,     color: "text-stone-400",  bg: "bg-stone-50",   label: "No expiry set" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return d; }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const EMPTY_FORM = {
  name: "", certType: "fsc", certCode: "", issuedBy: "Control Union Certifications B.V.",
  issuedTo: "BZA International Services LLC", validFrom: "", validUntil: "",
  standard: "", notes: "",
};

export function CertificatesClient({ initialCerts }: { initialCerts: Cert[] }) {
  const [certs, setCerts] = useState<Cert[]>(initialCerts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownload(id: number, fileName: string) {
    const res = await fetch(`/api/certificates/${id}`);
    const data = await res.json();
    if (!data.fileUrl) return;
    const a = document.createElement("a");
    a.href = data.fileUrl;
    a.download = fileName || `certificate-${id}.pdf`;
    a.click();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this certificate?")) return;
    setDeleting(id);
    try {
      await apiMutate(`/api/certificates/${id}`, { method: "DELETE" });
      setCerts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete the certificate.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);

      const res = await fetch("/api/certificates", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }

      // Refresh list
      const listRes = await fetch("/api/certificates");
      const list = await listRes.json();
      setCerts(list);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#0d3d3b] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2e2d] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Certificate
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-800">Add Certificate</h2>
              <button onClick={() => { setShowForm(false); setError(null); }} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Certificate Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                    placeholder="FSC Chain of Custody"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Type *</label>
                  <select value={form.certType} onChange={e => setForm(f => ({ ...f, certType: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30">
                    <option value="fsc">FSC</option>
                    <option value="pefc">PEFC</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Certification Code</label>
                  <input value={form.certCode} onChange={e => setForm(f => ({ ...f, certCode: e.target.value }))}
                    placeholder="CU-COC-892954"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issued By</label>
                  <input value={form.issuedBy} onChange={e => setForm(f => ({ ...f, issuedBy: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Issued To</label>
                  <input value={form.issuedTo} onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Valid From</label>
                  <input type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Valid Until</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Standard</label>
                  <input value={form.standard} onChange={e => setForm(f => ({ ...f, standard: e.target.value }))}
                    placeholder="FSC-STD-40-004 V3-1"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1">Certificate PDF</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-stone-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#0d3d3b]/40 transition-colors"
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-stone-700">
                        <FileText className="w-4 h-4 text-[#0d3d3b]" />
                        <span>{file.name}</span>
                        <span className="text-stone-400">({formatSize(file.size)})</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-stone-400">
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Click to upload PDF (max 10MB)</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>

              {error && <p className="text-xs text-stone-600 bg-stone-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setError(null); }}
                  className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-[#0d3d3b] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2e2d] disabled:opacity-60 transition-colors">
                  {saving ? "Saving…" : "Save Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty state */}
      {certs.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <Award className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No certificates yet</p>
          <p className="text-stone-400 text-sm mt-1">Add BZA&apos;s FSC and PEFC compliance certificates</p>
        </div>
      )}

      {/* Cert cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certs.map(cert => {
          const typeConf = TYPE_COLORS[cert.certType] ?? TYPE_COLORS.other;
          const status = certStatus(cert.validUntil);
          const statusConf = STATUS_CONFIG[status];
          const StatusIcon = statusConf.icon;

          return (
            <div key={cert.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0d3d3b]/10 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5 text-[#0d3d3b]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">{cert.name}</h3>
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${typeConf.bg} ${typeConf.text}`}>
                      {typeConf.label}
                    </span>
                  </div>
                </div>
                {/* Status badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConf.label}
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-2.5">
                {cert.certCode && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 w-24 shrink-0">Code</span>
                    <span className="text-xs font-semibold text-stone-700 bg-stone-50 px-2 py-0.5 rounded">{cert.certCode}</span>
                  </div>
                )}
                {cert.issuedBy && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-stone-400 w-24 shrink-0">Issued by</span>
                    <span className="text-xs text-stone-600">{cert.issuedBy}</span>
                  </div>
                )}
                {cert.issuedTo && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-stone-400 w-24 shrink-0">Issued to</span>
                    <span className="text-xs text-stone-600">{cert.issuedTo}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 w-24 shrink-0">Valid period</span>
                  <span className="text-xs text-stone-600">
                    {cert.validFrom ? formatDate(cert.validFrom) : "—"} → {cert.validUntil ? formatDate(cert.validUntil) : "—"}
                  </span>
                </div>
                {cert.standard && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-stone-400 w-24 shrink-0">Standard</span>
                    <span className="text-xs text-stone-500 leading-relaxed">{cert.standard}</span>
                  </div>
                )}
                {cert.notes && (
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-stone-400 w-24 shrink-0">Notes</span>
                    <span className="text-xs text-stone-500">{cert.notes}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-5 py-3 bg-stone-50 border-t border-stone-100">
                <div className="flex items-center gap-1.5 text-xs text-stone-400 min-w-0 flex-1">
                  {cert.fileName ? (
                    <>
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate" title={cert.fileName}>{cert.fileName}</span>
                      {cert.fileSize && <span className="text-stone-300 shrink-0 whitespace-nowrap">· {formatSize(cert.fileSize)}</span>}
                    </>
                  ) : (
                    <span className="italic">No file attached</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cert.fileName && (
                    <button
                      onClick={() => handleDownload(cert.id, cert.fileName!)}
                      className="flex items-center gap-1 text-xs text-[#0d3d3b] hover:text-[#0a2e2d] px-2 py-1 rounded hover:bg-[#0d3d3b]/5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(cert.id)}
                    disabled={deleting === cert.id}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 px-2 py-1 rounded hover:bg-stone-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting === cert.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
