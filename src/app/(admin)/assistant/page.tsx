"use client";

import { useState, useRef, useEffect } from "react";
import { BotMessageSquare, Paperclip, Image, FileSpreadsheet, FileText, X } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  imageUrl?: string; // base64 data URL for vision
};

const suggestions = [
  "Generate a PDF report for Kimberly Clark",
  "How much have we sold to Kimberly Clark?",
  "What is the margin per ton for Biopappel?",
  "How many invoices are pending collection?",
  "Give me a business summary for this year",
  "Generate an Excel report for all active shipments",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function send(text?: string) {
    const msg = text || input.trim();
    if ((!msg && !attachedFile) || loading) return;

    const userContent = attachedFile
      ? `${msg || "Process this file"}\nAttached: ${attachedFile.name}`
      : msg;

    const userMsg: Message = { role: "user", content: userContent, fileName: attachedFile?.name };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      let fileData: string | null = null;
      let imageUrl: string | null = null;

      if (attachedFile) {
        const formData = new FormData();
        formData.append("file", attachedFile);

        const uploadRes = await fetch("/api/ai/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          setError(uploadData.error || "Error processing file");
          setLoading(false);
          setAttachedFile(null);
          return;
        }

        if (uploadData.type === "image") {
          imageUrl = uploadData.imageUrl;
          // Store imageUrl on the user message for the API
          newMessages[newMessages.length - 1].imageUrl = imageUrl || undefined;
        }
        fileData = uploadData.parsedContent;
      }

      // Build messages for OpenAI
      const aiMessages = newMessages.map((m) => {
        // If message has an image, send as vision content
        if (m.imageUrl && m.role === "user") {
          return {
            role: m.role,
            content: m.content,
            imageUrl: m.imageUrl,
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      });

      // Append file text content to last message
      if (fileData && !imageUrl) {
        aiMessages[aiMessages.length - 1].content += `\n\n[FILE CONTENT]:\n${fileData}`;
      } else if (fileData && imageUrl) {
        aiMessages[aiMessages.length - 1].content += `\n\n${fileData}`;
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: aiMessages }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessages([...newMessages, { role: "assistant", content: data.message }]);
      } else {
        setError(data.error || "Error connecting to AI");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
      setAttachedFile(null);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">Ask me anything or attach files (Excel, PDF, images)</p>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-md shadow-sm p-6 text-center">
              <BotMessageSquare className="w-10 h-10 text-stone-400 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-stone-500 mb-2">
                I have access to your real-time business data. Attach files and I&apos;ll read them.
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
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-xs bg-card border border-border rounded-lg px-3 py-2 hover:bg-muted transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                __html: msg.role === "assistant"
                  ? msg.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\[([^\]]+)\]\((?:sandbox:)?(\/api\/[^\)]+)\)/g, '<a href="$2" target="_blank" class="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 no-underline mt-1">$1</a>')
                      .replace(/\n/g, "<br>")
                  : msg.content,
              }} />
              {msg.imageUrl && (
                <div className="mt-2 text-xs text-stone-400 flex items-center gap-1"><Image className="w-3 h-3" /> Image sent to vision</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg p-3 text-sm text-muted-foreground">
              {attachedFile ? `Processing ${attachedFile.name}...` : "Thinking..."}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Attached file indicator */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 bg-muted rounded-lg px-3 py-2">
          <span className="text-xs flex items-center gap-1"><Paperclip className="w-3 h-3" /> {attachedFile.name}</span>
          <button onClick={() => setAttachedFile(null)} className="text-xs text-stone-400 hover:text-stone-600"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp" onChange={handleFileSelect} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="border border-border px-3 py-3 rounded-lg text-sm hover:bg-muted disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={attachedFile ? `Message about ${attachedFile.name}...` : "Type your question... (Shift+Enter for new line)"}
          disabled={loading}
          rows={1}
          className="flex-1 border border-border rounded-lg px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none overflow-hidden"
          style={{ minHeight: "48px", maxHeight: "200px" }}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 200) + "px";
            }
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || (!input.trim() && !attachedFile)}
          className="bg-primary text-primary-foreground px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
