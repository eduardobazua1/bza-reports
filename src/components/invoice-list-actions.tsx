"use client";

import { useState, useTransition } from "react";
import { deleteInvoice } from "@/server/actions";
import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";

type Invoice = {
  id: number;
  invoiceNumber: string;
  purchaseOrderId: number;
  quantityTons: number;
  unit: string;
  sellPriceOverride: number | null;
  buyPriceOverride: number | null;
  shipmentDate: string | null;
  estimatedArrival: string | null;
  shipmentStatus: "programado" | "en_transito" | "en_aduana" | "entregado";
  customerPaymentStatus: "paid" | "unpaid";
  supplierPaymentStatus: "paid" | "unpaid";
  usesFactoring: boolean;
  freightCost: number | null;
  item: string | null;
  notes: string | null;
};

type Doc = { id: number; fileName: string; type: string };

type EmailLog = {
  id: number;
  sentAt: string;
  sentTo: string;
  sentCc: string | null;
  attachmentCount: number | null;
  openCount: number | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = iso.split("T")[0].split("-");
  return `${p[1].padStart(2,"0")}/${p[2].padStart(2,"0")}/${p[0]} ` + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function InvoiceListActions({
  invoice,
  clientEmail,
}: {
  invoice: Invoice;
  clientEmail?: string | null;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sendTo, setSendTo] = useState(clientEmail || "");
  const [sendCc, setSendCc] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    startTransition(async () => {
      await deleteInvoice(invoice.id);
      router.refresh();
    });
  }

  async function openSendPanel() {
    setSendTo(clientEmail || "");
    setSendCc("");
    setDocsLoading(true);
    setShowSend(true);
    setShowHistory(false);
    try {
      const res = await fetch(`/api/documents?invoiceId=${invoice.id}`);
      if (res.ok) {
        const all: Doc[] = await res.json();
        const blPl = all.filter(d => d.type === "bl" || d.type === "pl");
        setDocs(blPl);
        setSelectedDocIds(blPl.map(d => d.id));
      }
    } finally {
      setDocsLoading(false);
    }
  }

  async function openHistory() {
    setShowHistory(true);
    setShowSend(false);
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/invoice-email-logs?invoiceNumber=${encodeURIComponent(invoice.invoiceNumber)}`);
      if (res.ok) setEmailLogs(await res.json());
    } finally {
      setLogsLoading(false);
    }
  }

  function toggleDoc(id: number) {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSend() {
    if (!sendTo) return;
    setSendLoading(true);
    const res = await fetch("/api/invoice-pdf/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber, to: sendTo, cc: sendCc || undefined, documentIds: selectedDocIds }),
    });
    if (res.ok) {
      const data = await res.json();
      setSent(true);
      setShowSend(false);
      alert(`Sent! ${data.attachmentCount} attachment(s) delivered.`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error sending email");
    }
    setSendLoading(false);
  }

  if (showEdit) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <InvoiceForm
            invoice={invoice}
            purchaseOrderId={invoice.purchaseOrderId}
            onCancel={() => setShowEdit(false)}
          />
        </div>
      </div>
    );
  }

  if (showSend) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            type="email"
            className="border border-stone-300 rounded px-2 py-1 text-xs w-44"
            placeholder="To"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
          />
          <input
            type="email"
            className="border border-stone-300 rounded px-2 py-1 text-xs w-36"
            placeholder="CC (optional)"
            value={sendCc}
            onChange={(e) => setSendCc(e.target.value)}
          />
          <button
            onClick={handleSend}
            disabled={sendLoading || !sendTo}
            className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {sendLoading ? "Sending..." : "Send"}
          </button>
          <button onClick={() => setShowSend(false)} className="text-xs text-stone-400 hover:text-stone-600">
            Cancel
          </button>
        </div>
        {docsLoading ? (
          <p className="text-[10px] text-stone-400">Loading documents...</p>
        ) : docs.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-[10px] text-stone-500 font-medium">Attach:</span>
            {docs.map(d => (
              <label key={d.id} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3 h-3"
                  checked={selectedDocIds.includes(d.id)}
                  onChange={() => toggleDoc(d.id)}
                />
                <svg className="w-3 h-3 text-[#5eead4] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <span className="text-[10px] text-stone-600">{d.fileName}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-stone-400">Invoice PDF only (no BOL/PL uploaded)</p>
        )}
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="flex flex-col gap-2 items-end min-w-[320px]">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-semibold text-stone-700">Send history — {invoice.invoiceNumber}</span>
          <button onClick={() => setShowHistory(false)} className="text-xs text-stone-400 hover:text-stone-600">Close</button>
        </div>
        {logsLoading ? (
          <p className="text-xs text-stone-400">Loading...</p>
        ) : emailLogs.length === 0 ? (
          <p className="text-xs text-stone-400 italic">Never sent.</p>
        ) : (
          <div className="w-full space-y-2">
            {emailLogs.map(log => (
              <div key={log.id} className="bg-stone-50 border border-stone-200 rounded p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-medium text-stone-800">{fmtDateTime(log.sentAt)}</p>
                    <p className="text-stone-500">To: <span className="text-stone-700">{log.sentTo}</span></p>
                    {log.sentCc && <p className="text-stone-500">CC: <span className="text-stone-700">{log.sentCc}</span></p>}
                    <p className="text-stone-500">{log.attachmentCount ?? 1} attachment(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    {(log.openCount ?? 0) > 0 ? (
                      <div className="space-y-0.5">
                        <span className="inline-block bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-[10px]">
                          Opened {log.openCount}×
                        </span>
                        <p className="text-[10px] text-stone-400">First: {fmtDateTime(log.firstOpenedAt)}</p>
                        <p className="text-[10px] text-stone-400">Last: {fmtDateTime(log.lastOpenedAt)}</p>
                      </div>
                    ) : (
                      <span className="inline-block bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full text-[10px]">Not opened</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-2 justify-end items-center">
        <a
          href={`/api/invoice-pdf?invoice=${invoice.invoiceNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:underline font-medium"
        >
          PDF
        </a>
        {!invoice.invoiceNumber.startsWith("PEND-") && (
          sent ? (
            <span className="text-xs text-emerald-600 font-medium">Sent ✓</span>
          ) : (
            <button onClick={openSendPanel} className="text-xs text-[#0d9488] hover:underline font-medium">
              Send
            </button>
          )
        )}
        <button onClick={() => setShowEdit(true)} className="text-xs text-primary hover:underline">
          Edit
        </button>
        <button onClick={handleDelete} disabled={isPending} className="text-xs text-destructive hover:underline">
          Delete
        </button>
      </div>
      {!invoice.invoiceNumber.startsWith("PEND-") && (
        <button onClick={openHistory} className="text-[10px] text-stone-400 hover:text-stone-600 hover:underline">
          Activity
        </button>
      )}
    </div>
  );
}
