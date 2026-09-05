"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { BotMessageSquare, Paperclip, Image, FileSpreadsheet, FileText, X, Upload, Plus, MessageSquare, Trash2, PanelLeft, Brain } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileNames?: string[];
  imageUrls?: string[];
};

type Conversation = { id: number; title: string; updatedAt: string };

const suggestions = [
  "Generate a PDF report for Kimberly Clark",
  "How much have we sold to Kimberly Clark?",
  "What is the margin per ton for Biopappel?",
  "How many invoices are pending collection?",
  "Give me a business summary for this year",
  "Generate an Excel report for all active shipments",
];

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext || "")) return <FileSpreadsheet className="w-3 h-3" />;
  if (ext === "pdf") return <FileText className="w-3 h-3" />;
  return <Image className="w-3 h-3" />;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/conversations");
      if (res.ok) setConversations(await res.json());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { refreshList(); }, [refreshList]);

  // Persist the current thread (text only — images are not stored to keep the DB small).
  async function persist(msgs: Message[], cid: number | null): Promise<number | null> {
    try {
      let id = cid;
      if (!id) {
        const firstUser = msgs.find((m) => m.role === "user")?.content || "New conversation";
        const res = await fetch("/api/ai/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: firstUser.replace(/\nAttached:[\s\S]*/, "").slice(0, 80) }),
        });
        id = (await res.json()).id;
        setConversationId(id);
      }
      await fetch(`/api/ai/conversations/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
      });
      refreshList();
      return id;
    } catch { return cid; }
  }

  function newChat() {
    setMessages([]);
    setConversationId(null);
    setInput("");
    setAttachedFiles([]);
    setError(null);
  }

  async function loadConversation(id: number) {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      setConversationId(id);
      setError(null);
    } catch { /* ignore */ }
  }

  async function deleteConversation(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) newChat();
    refreshList();
  }

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(xlsx|xls|csv|pdf|png|jpg|jpeg|webp)$/i.test(f.name));
    if (files.length > 0) setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => /\.(xlsx|xls|csv|pdf|png|jpg|jpeg|webp)$/i.test(f.name));
    setAttachedFiles((prev) => [...prev, ...files]);
  }
  function removeFile(idx: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send(text?: string) {
    const msg = text || input.trim();
    if ((!msg && attachedFiles.length === 0) || loading) return;

    const fileNames = attachedFiles.map((f) => f.name);
    const userContent = fileNames.length > 0
      ? `${msg || "Process these files"}\nAttached: ${fileNames.join(", ")}`
      : msg;

    const userMsg: Message = { role: "user", content: userContent, fileNames };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

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
        if (!uploadRes.ok) {
          setError(uploadData.error || `Error processing ${file.name}`);
          setLoading(false);
          return;
        }
        if (uploadData.type === "image" && uploadData.imageUrl) allImageUrls.push(uploadData.imageUrl);
        if (uploadData.parsedContent) allFileData.push(`[${file.name}]:\n${uploadData.parsedContent}`);
      }

      if (allImageUrls.length > 0) newMessages[newMessages.length - 1].imageUrls = allImageUrls;

      const aiMessages = newMessages.map((m) => {
        if (m.imageUrls && m.role === "user") return { role: m.role, content: m.content, imageUrls: m.imageUrls };
        return { role: m.role, content: m.content };
      });
      if (allFileData.length > 0) {
        aiMessages[aiMessages.length - 1].content += `\n\n[FILE CONTENTS]:\n${allFileData.join("\n\n---\n\n")}`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: aiMessages }),
      });
      const data = await res.json();

      if (res.ok) {
        const finalMessages: Message[] = [...newMessages, { role: "assistant", content: data.message }];
        setMessages(finalMessages);
        persist(finalMessages, conversationId);
      } else {
        setError(data.error || "Error connecting to AI");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex h-[calc(100vh-3rem)] relative gap-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="w-12 h-12 text-primary" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-primary">Drop files here</p>
          <p className="text-sm text-primary/70">Excel, PDF, Images</p>
        </div>
      )}

      {/* History sidebar */}
      {showHistory && (
        <aside className="w-60 shrink-0 flex flex-col bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <button onClick={newChat} className="w-full flex items-center justify-center gap-2 bg-[#0d3d3b] text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" /> New chat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-stone-400 text-center mt-4">No past conversations yet.</p>
            ) : conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer ${c.id === conversationId ? "bg-[#e6f1ee] text-[#0d3d3b]" : "hover:bg-stone-50 text-stone-600"}`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{c.title}</span>
                <button onClick={(e) => deleteConversation(c.id, e)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-stone-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Link href="/assistant/memory" className="flex items-center gap-2 px-3 py-2.5 border-t border-stone-100 text-xs text-stone-500 hover:bg-stone-50">
            <Brain className="w-3.5 h-3.5" /> What the AI remembers
          </Link>
        </aside>
      )}

      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 flex items-start gap-2">
          <button onClick={() => setShowHistory((s) => !s)} className="mt-1 text-stone-400 hover:text-stone-700" title="Toggle history">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">BZA Intelligence</h1>
            <p className="text-sm text-muted-foreground">Learns your rules and remembers past chats. Attach Excel, PDF, or images.</p>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] p-6 text-center">
                <BotMessageSquare className="w-10 h-10 text-stone-400 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-stone-500 mb-3">
                  I have real-time access to your data and remember what you teach me. Attach files by dragging them here.
                </p>
                <div className="flex justify-center gap-3 text-xs text-stone-400">
                  <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded"><FileSpreadsheet className="w-3 h-3" /> Excel</span>
                  <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded"><FileText className="w-3 h-3" /> PDF</span>
                  <span className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded"><Image className="w-3 h-3" /> Images</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Try:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)}
                      className="text-xs bg-card border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                  __html: msg.role === "assistant"
                    ? msg.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\[([^\]]+)\]\((?:sandbox:)?(\/api\/[^\)]+)\)/g, '<a href="$2" target="_blank" class="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 no-underline mt-1">$1</a>')
                        .replace(/\n/g, "<br>")
                    : msg.content,
                }} />
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className="mt-1 text-xs text-stone-300 flex items-center gap-1">
                    <Image className="w-3 h-3" /> {msg.imageUrls.length} image{msg.imageUrls.length > 1 ? "s" : ""} sent
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-lg p-3 text-sm text-muted-foreground">
                {attachedFiles.length > 0 ? `Processing ${attachedFiles.length} file(s)...` : "Thinking..."}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#0d3d3b] border border-[#0d3d3b] rounded-lg p-3 text-sm text-white mb-3">{error}</div>
        )}

        {/* Attached files chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-2.5 py-1.5 text-xs">
                {fileIcon(f.name)}
                <span className="max-w-[160px] truncate">{f.name}</span>
                <button onClick={() => removeFile(i)} className="text-stone-400 hover:text-stone-600 ml-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp" multiple onChange={(e) => addFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="border border-border px-3 py-3 rounded-lg text-sm hover:bg-muted disabled:opacity-50 relative" title="Attach files">
            <Paperclip className="w-4 h-4" />
            {attachedFiles.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{attachedFiles.length}</span>
            )}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={attachedFiles.length > 0 ? `Message about ${attachedFiles.length} file(s)... (Enter to send)` : "Type your question... (Shift+Enter for new line)"}
            disabled={loading}
            rows={1}
            className="flex-1 border border-border rounded-lg px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none overflow-hidden"
            style={{ minHeight: "48px", maxHeight: "200px" }}
            ref={textareaRef}
          />
          <button onClick={() => send()} disabled={loading || (!input.trim() && attachedFiles.length === 0)}
            className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
