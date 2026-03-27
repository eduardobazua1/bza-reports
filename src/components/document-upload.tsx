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
  invoice: "bg-blue-50 text-blue-600",
  bl: "bg-emerald-50 text-emerald-600",
  pl: "bg-amber-50 text-amber-600",
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoiceId", invoiceId.toString());
    formData.append("type", selectedType);

    const res = await fetch("/api/documents", { method: "POST", body: formData });
    if (res.ok) {
      await loadDocs();
      setShowUpload(false);
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

  return (
    <div>
      {/* Document list */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-1.5 bg-stone-50 rounded-md px-2 py-1 group">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeColors[doc.type] || typeColors.other}`}>
                {typeLabels[doc.type]}
              </span>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-stone-600 hover:text-blue-600 hover:underline truncate max-w-[120px]"
                title={doc.fileName}
              >
                {doc.fileName}
              </a>
              <span className="text-[9px] text-stone-300">{formatSize(doc.fileSize)}</span>
              <button
                onClick={() => handleDelete(doc)}
                className="text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
            className="text-[11px] bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
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
          <File className="w-3 h-3" />
          {typeLabels[doc.type]}
        </a>
      ))}
    </div>
  );
}
