"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Upload, Trash2, Download, File } from "lucide-react";

type Doc = {
  id: number;
  invoiceId: number;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  uploadedAt: string;
};

const typeLabels: Record<string, string> = {
  invoice: "Invoice",
  bl: "Bill of Lading",
  pl: "Packing List",
  other: "Other",
};

const typeColors: Record<string, string> = {
  invoice: "bg-[#ccfbf1] text-[#0d3d3b]",
  bl: "bg-[#ccfbf1] text-[#0d3d3b]",
  pl: "bg-[#ccfbf1] text-[#0d3d3b]",
  other: "bg-stone-100 text-stone-500",
};

export function DocumentUpload({ invoiceId, invoiceNumber }: { invoiceId: number; invoiceNumber: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<string>("bl");

  async function loadDocs() {
    const res = await fetch(`/api/documents?invoiceId=${invoiceId}`);
    if (res.ok) setDocs(await res.json());
  }

  useEffect(() => { loadDocs(); }, [invoiceId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoiceId", invoiceId.toString());
      formData.append("type", selectedType);

      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        await loadDocs();
        setShowUpload(false);
      } else {
        alert(`Upload failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      alert(`Upload error: ${err instanceof Error ? err.message : "Connection error"}`);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Delete ${typeLabels[doc.type]}: ${doc.fileName}?`)) return;
    await fetch("/api/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, fileUrl: doc.fileUrl }),
    });
    await loadDocs();
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  const isPending = invoiceNumber.startsWith("PEND-");

  return (
    <div>
      {/* Document list */}
      <div className="flex flex-wrap gap-2 mb-2">
        {/* Invoice PDF link — always shown unless pending */}
        {!isPending && (
          <div className="flex items-center gap-1.5 bg-stone-50 rounded-md px-2 py-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#ccfbf1] text-[#0d3d3b]">Invoice</span>
            <a
              href={`/api/invoice-pdf?invoice=${invoiceNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-stone-600 hover:text-[#0d3d3b] hover:underline"
            >
              <svg className="w-3 h-3 text-[#5eead4] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              {invoiceNumber}.pdf
            </a>
          </div>
        )}
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center gap-1.5 bg-stone-50 rounded-md px-2 py-1 group">
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeColors[doc.type] || typeColors.other}`}>
              {typeLabels[doc.type]}
            </span>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-stone-600 hover:text-[#0d3d3b] hover:underline truncate max-w-[120px]"
              title={doc.fileName}
            >
              <svg className="w-3 h-3 text-[#5eead4] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              {doc.fileName}
            </a>
            <span className="text-[9px] text-stone-300">{formatSize(doc.fileSize)}</span>
            <button
              onClick={() => handleDelete(doc)}
              className="text-stone-300 hover:text-[#0d3d3b] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Upload button / form */}
      {!showUpload ? (
        <button
          onClick={() => setShowUpload(true)}
          className="text-[11px] text-stone-400 hover:text-stone-600 flex items-center gap-1"
        >
          <Upload className="w-3 h-3" />
          Upload document
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-stone-50 rounded-md p-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-[11px] border border-stone-200 rounded px-1.5 py-1 bg-white"
          >
            <option value="bl">Bill of Lading</option>
            <option value="pl">Packing List</option>
            <option value="invoice">Invoice</option>
            <option value="other">Other</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-[11px] bg-[#0d3d3b] text-white px-2 py-1 rounded hover:bg-[#0d3d3b] disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Choose file"}
          </button>
          <button
            onClick={() => setShowUpload(false)}
            className="text-[11px] text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// Read-only version for client portal
export function DocumentList({ invoiceId }: { invoiceId: number }) {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    fetch(`/api/documents?invoiceId=${invoiceId}`)
      .then(r => r.json())
      .then(setDocs)
      .catch(() => {});
  }, [invoiceId]);

  if (docs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {docs.map((doc) => (
        <a
          key={doc.id}
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-medium hover:opacity-80 ${typeColors[doc.type] || typeColors.other}`}
        >
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          {typeLabels[doc.type]}
        </a>
      ))}
    </div>
  );
}
