"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, Trash2, FileText, Loader2, Mail, Send, X, Paperclip } from "lucide-react";

type Doc = { id: number; itemKey: string; cert: string | null; title: string | null; fileName: string; fileSize: number | null; uploadedAt: string };

// Document slots to attach for Control Union.
const ITEMS: { key: string; title: string }[] = [
  { key: "procedures", title: "FSC & PEFC Procedures Manual (Handbook)" },
  { key: "labor",      title: "FSC core labour requirements self-assessment" },
  { key: "outsourcer", title: "Outsourcer / contractor evaluation" },
  { key: "other",      title: "Other supporting documents (values commitment, trademark license, internal & audit reports…)" },
];

const DEFAULT_RECIPIENT = "jyimgang@controlunion.com";

function fmtSize(b: number | null) { if (!b) return ""; return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`; }

export function AuditPackage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [emailOpen, setEmailOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [includeReport, setIncludeReport] = useState(true);
  const [to, setTo] = useState(DEFAULT_RECIPIENT);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("BZA International Services — FSC/PEFC Chain of Custody documentation");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [addressBook, setAddressBook] = useState<string[]>([]);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/audit-docs"); const d = await r.json(); if (Array.isArray(d)) setDocs(d); } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(itemKey: string, file: File) {
    setUploading(itemKey);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("itemKey", itemKey);
      const r = await fetch("/api/audit-docs", { method: "POST", body: fd });
      if (!r.ok) throw new Error();
      await load();
    } catch { alert("Could not upload the file."); }
    finally { setUploading(null); }
  }
  async function remove(id: number) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/audit-docs?id=${id}`, { method: "DELETE" });
    load();
  }
  function toggle(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function openComposer() {
    setSent(null);
    setSelected(new Set(docs.map((d) => d.id))); // preselect all by default
    setIncludeReport(true);
    setEmailOpen((v) => !v);
    // Load the address book so recipients autocomplete from what was used before.
    fetch("/api/email-recipients")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAddressBook(d.addresses || []); })
      .catch(() => {});
  }

  const attachCount = selected.size + (includeReport ? 1 : 0);

  async function send() {
    if (attachCount === 0) { alert("Select at least one document to send."); return; }
    if (!confirm(`Send ${attachCount} attachment(s) to ${to}?\n\nThis sends a real email now from info@bza-is.com.`)) return;
    setSending(true); setSent(null);
    try {
      const r = await fetch("/api/audit-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, message, includeReport, docIds: Array.from(selected) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Send failed");
      setSent(`Sent ${d.sent} attachment(s) to ${to}.`); setEmailOpen(false);
    } catch (e) { alert((e as Error).message); }
    finally { setSending(false); }
  }

  const totalFiles = docs.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-4 space-y-3">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#0d3d3b]" />
          <div>
            <p className="font-semibold text-stone-800">Attachments</p>
            <p className="text-xs text-stone-400">{totalFiles} document(s) stored. Attach the handbook, assessments and supporting docs to send to Control Union.</p>
          </div>
        </div>
        <button onClick={openComposer}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[#0d3d3b] text-white rounded-lg px-3 py-2 hover:opacity-90 shrink-0">
          <Send className="w-3.5 h-3.5" /> Send
        </button>
      </div>

      {sent && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-800">{sent}</div>}

      {/* email composer */}
      {emailOpen && (
        <div className="border border-[#0d3d3b]/20 rounded-lg p-3 space-y-2 bg-stone-50/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-700 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#0d3d3b]" /> Send {attachCount} selected attachment(s)</p>
            <button onClick={() => setEmailOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
          </div>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={includeReport} onChange={(e) => setIncludeReport(e.target.checked)} /> Include Sales Aging Report (.xlsx)
          </label>
          <p className="text-[11px] text-stone-400">Tick the documents below to include them, then Send.</p>
          <datalist id="audit-email-book">{addressBook.map((a) => <option key={a} value={a} />)}</datalist>
          <input list="audit-email-book" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" className="w-full border border-stone-200 rounded px-2 py-1 text-xs" />
          <input list="audit-email-book" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC (optional)" className="w-full border border-stone-200 rounded px-2 py-1 text-xs" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full border border-stone-200 rounded px-2 py-1 text-xs" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Optional note…" className="w-full border border-stone-200 rounded px-2 py-1 text-xs" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEmailOpen(false)} className="text-xs font-semibold text-stone-600 rounded px-3 py-1.5 hover:bg-stone-100">Cancel</button>
            <button onClick={send} disabled={sending || !to} className="flex items-center gap-1.5 text-xs font-semibold bg-[#0d3d3b] text-white rounded px-4 py-1.5 hover:opacity-90 disabled:opacity-50">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
            </button>
          </div>
        </div>
      )}

      {/* attachment slots */}
      <div className="divide-y divide-stone-50">
        {ITEMS.map((item) => {
          const files = docs.filter((d) => d.itemKey === item.key);
          return (
            <div key={item.key} className="py-2.5 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-700">{item.title}</p>
                  {files.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {files.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 text-xs text-stone-600">
                          {emailOpen && <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="shrink-0" />}
                          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <a href={`/api/audit-docs?id=${f.id}`} className="text-[#0d3d3b] hover:underline truncate max-w-[360px]" title={f.fileName}>{f.fileName}</a>
                          <span className="text-stone-300 shrink-0">{fmtSize(f.fileSize)}</span>
                          <button onClick={() => remove(f.id)} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <input ref={(el) => { fileRefs.current[item.key] = el; }} type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(item.key, f); e.target.value = ""; }} />
                  <button onClick={() => fileRefs.current[item.key]?.click()} disabled={uploading === item.key}
                    className="flex items-center gap-1.5 text-xs font-semibold border border-stone-200 text-stone-700 rounded-lg px-3 py-1.5 hover:bg-stone-50 disabled:opacity-50">
                    {uploading === item.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-[#0d3d3b]" />} Upload
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
