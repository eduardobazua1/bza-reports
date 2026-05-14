"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Paperclip, FileSpreadsheet, FileText, Image, Upload, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; fileNames?: string[]; imageUrls?: string[] };
type EmailFormat = "excel" | "pdf" | "both";

const SUGGESTIONS = [
  "Process invoice document",
  "Active purchase orders?",
  "Unpaid invoices?",
  "Shipments in transit?",
];

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext || "")) return <FileSpreadsheet className="w-3 h-3" />;
  if (ext === "pdf") return <FileText className="w-3 h-3" />;
  return <Image className="w-3 h-3" />;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="text-sm whitespace-pre-wrap"
      dangerouslySetInnerHTML={{
        __html: content
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(
            /\[([^\]]+)\]\((?:sandbox:)?(\/api\/[^\)]+)\)/g,
            '<a href="$2" target="_blank" class="inline-flex items-center gap-1 bg-[#0d3d3b] text-white px-2.5 py-1 rounded-md text-xs font-medium hover:opacity-90 no-underline mt-1">$1</a>'
          )
          .replace(/\n/g, "<br>"),
      }}
    />
  );
}

// ── Email Report Panel ──────────────────────────────────────────────────────

const DEFAULT_COLS = [
  "poNumber", "clientPoNumber", "invoiceNumber", "item",
  "quantityTons", "shipmentDate", "shipmentStatus",
  "estimatedArrival", "currentLocation", "vehicleId",
];

function EmailReportPanel({ onBack }: { onBack: () => void }) {
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ clientId: "", email: "", format: "excel" as EmailFormat, activeOnly: true });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  async function handleSend() {
    if (!form.clientId || !form.email) return;
    setSending(true);
    setResult(null);
    const client = clients.find(c => c.id === Number(form.clientId));
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(form.clientId),
          email: form.email,
          subject: `Shipment Report – ${client?.name} – ${today}`,
          message: `Please find attached the latest shipment report for ${client?.name}.\n\nThis report was generated on ${today}.`,
          columns: DEFAULT_COLS,
          format: form.format,
          filter: form.activeOnly ? "active" : "all",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult("success");
      } else {
        setErrMsg(data.error || "Send failed.");
        setResult("error");
      }
    } catch {
      setErrMsg("Network error. Check connection.");
      setResult("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 bg-stone-50 flex flex-col rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#0d3d3b] px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="text-[#6ee7b7] hover:text-white transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-white flex-1">Send Report by Email</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {result === "success" ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="font-semibold text-stone-800">Report sent!</p>
            <p className="text-xs text-stone-500 max-w-[200px]">
              Check <span className="font-medium">{form.email}</span> for the attachment.
            </p>
            <button
              onClick={() => { setResult(null); setForm(f => ({ ...f, email: "" })); }}
              className="mt-2 text-xs text-[#0d9488] hover:underline"
            >
              Send another report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Client */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Client</label>
              <select
                value={form.clientId}
                onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20 focus:border-[#0d9488] appearance-none"
              >
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Recipient</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="recipient@example.com"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/20 focus:border-[#0d9488]"
              />
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Format</label>
              <div className="flex gap-2">
                {(["excel", "pdf", "both"] as EmailFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setForm(ef => ({ ...ef, format: f }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      form.format === f
                        ? "bg-[#0d3d3b] text-white border-[#0d3d3b]"
                        : "bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {f === "excel" ? "Excel" : f === "pdf" ? "PDF" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.activeOnly}
                  onChange={e => setForm(f => ({ ...f, activeOnly: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${form.activeOnly ? "bg-[#0d3d3b]" : "bg-stone-200"}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.activeOnly ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-sm text-stone-700">Active shipments only</span>
            </label>

            {/* Error */}
            {result === "error" && (
              <div className="flex items-start gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errMsg}</span>
              </div>
            )}

            {/* Columns note */}
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Includes: PO, Invoice, Item, Qty, Ship Date, Status, ETA, Location, Vehicle.
              For custom columns use the <span className="text-[#0d9488]">Reports</span> page.
            </p>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!form.clientId || !form.email || sending}
              className="w-full bg-[#0d3d3b] text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Report
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────────

export function IntelligenceWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (open) setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 80);
  }, [messages, loading, open]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  }, [input]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current++;
    if (e.dataTransfer.items?.length > 0) setDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(xlsx|xls|csv|pdf|png|jpg|jpeg|webp)$/i.test(f.name));
    if (files.length > 0) setAttachedFiles(p => [...p, ...files]);
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setAttachedFiles(p => [...p, ...Array.from(list).filter(f => /\.(xlsx|xls|csv|pdf|png|jpg|jpeg|webp)$/i.test(f.name))]);
  }

  async function send(text?: string) {
    const msg = (text || input).trim();
    if ((!msg && attachedFiles.length === 0) || loading) return;

    const fileNames = attachedFiles.map(f => f.name);
    const userContent = fileNames.length > 0 ? `${msg || "Process these files"}\nAttached: ${fileNames.join(", ")}` : msg;
    const userMsg: Message = { role: "user", content: userContent, fileNames };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    const filesToProcess = [...attachedFiles];
    setAttachedFiles([]);

    try {
      const allFileData: string[] = [];
      const allImageUrls: string[] = [];

      for (const file of filesToProcess) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/ai/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.type === "image" && uploadData.imageUrl) allImageUrls.push(uploadData.imageUrl);
        if (uploadData.parsedContent) allFileData.push(`[${file.name}]:\n${uploadData.parsedContent}`);
      }

      if (allImageUrls.length > 0) newMessages[newMessages.length - 1].imageUrls = allImageUrls;

      const aiMessages = newMessages.map(m =>
        m.imageUrls && m.role === "user"
          ? { role: m.role, content: m.content, imageUrls: m.imageUrls }
          : { role: m.role, content: m.content }
      );
      if (allFileData.length > 0) aiMessages[aiMessages.length - 1].content += `\n\n[FILE CONTENTS]:\n${allFileData.join("\n\n---\n\n")}`;

      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: aiMessages }) });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.message || "No response." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Connection error." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#0d3d3b] text-[#6ee7b7] text-xl flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        style={{ display: open ? "none" : "flex" }}
        title="BZA Intelligence"
      >
        ✦
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 380, height: 560 }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {dragging && (
            <div className="absolute inset-0 z-10 bg-[#0d3d3b]/10 border-2 border-dashed border-[#0d3d3b] rounded-2xl flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-8 h-8 text-[#0d3d3b]" />
              <p className="text-sm font-semibold text-[#0d3d3b]">Drop files here</p>
            </div>
          )}

          {/* Email Report Panel (overlay) */}
          {emailPanelOpen && (
            <EmailReportPanel onBack={() => setEmailPanelOpen(false)} />
          )}

          {/* Header */}
          <div className="bg-[#0d3d3b] px-4 py-3 flex items-center justify-between shrink-0">
            <span className="text-sm font-bold text-white">✦  BZA Intelligence</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEmailPanelOpen(true)}
                className="text-[#6ee7b7] hover:text-white transition-colors"
                title="Send report by email"
              >
                <Mail className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="text-[#6ee7b7] hover:text-white transition-colors leading-none" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto bg-stone-50 p-3 space-y-2">
            {messages.length === 0 && (
              <div className="space-y-2">
                {SUGGESTIONS.map(s => (
                  <button key={s}
                    onClick={() => {
                      if (s === "Process invoice document") {
                        fileRef.current?.click();
                      } else {
                        send(s);
                      }
                    }}
                    className="w-full text-left text-xs bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-[#0d9488] font-medium hover:bg-stone-50 transition-colors flex items-center gap-2">
                    {s === "Process invoice document" && <Paperclip className="w-3 h-3 shrink-0" />}
                    {s}
                  </button>
                ))}
                {/* Email shortcut */}
                <button
                  onClick={() => setEmailPanelOpen(true)}
                  className="w-full text-left text-xs bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-[#0d9488] font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                  <Mail className="w-3 h-3 shrink-0" />
                  Send shipment report by email
                </button>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-[#0d3d3b] text-white rounded-br-sm" : "bg-white border border-stone-200 text-stone-800 rounded-bl-sm"}`}>
                  {m.role === "assistant" ? <MarkdownContent content={m.content} /> : <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
                  {m.fileNames && m.fileNames.length > 0 && (
                    <p className="text-[10px] mt-1 opacity-60">{m.fileNames.join(", ")}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-[#0d9488] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="bg-white border-t border-stone-100 px-3 py-2 flex flex-wrap gap-1.5 shrink-0">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs">
                  {fileIcon(f.name)}
                  <span className="max-w-[120px] truncate text-stone-600">{f.name}</span>
                  <button onClick={() => setAttachedFiles(p => p.filter((_, j) => j !== i))} className="text-stone-400 hover:text-stone-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-stone-100 px-3 py-2.5 flex gap-2 items-end shrink-0">
            <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp" multiple onChange={e => addFiles(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={loading} className="text-stone-400 hover:text-stone-600 relative shrink-0 pb-1" title="Attach files">
              <Paperclip className="w-4 h-4" />
              {attachedFiles.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#0d3d3b] text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{attachedFiles.length}</span>
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything..."
              disabled={loading}
              rows={1}
              className="flex-1 bg-stone-50 rounded-2xl px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none resize-none overflow-hidden"
              style={{ minHeight: 36, maxHeight: 120 }}
            />
            <button
              onClick={() => send()}
              disabled={loading || (!input.trim() && attachedFiles.length === 0)}
              className="shrink-0 w-8 h-8 rounded-full bg-[#0d3d3b] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity pb-0.5"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
