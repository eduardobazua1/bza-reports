"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const reportColumns = [
  { key: "currentLocation", label: "Current Location", default: true },
  { key: "lastLocationUpdate", label: "Last Update", default: false },
  { key: "poNumber", label: "PO # (BZA)", default: true },
  { key: "clientPoNumber", label: "Client PO", default: true },
  { key: "invoiceNumber", label: "Invoice #", default: true },
  { key: "vehicleId", label: "Vehicle ID", default: true },
  { key: "blNumber", label: "BL Number", default: true },
  { key: "quantityTons", label: "Quantity (TN)", default: true },
  { key: "sellPrice", label: "Price", default: true },
  { key: "shipmentStatus", label: "Status", default: true },
  { key: "shipmentDate", label: "Ship Date", default: true },
  { key: "estimatedArrival", label: "ETA", default: false },
  { key: "item", label: "Product", default: false },
  { key: "billingDocument", label: "Billing Doc.", default: false },
  { key: "terms", label: "Terms", default: false },
  { key: "transportType", label: "Transport Type", default: false },
  { key: "licenseFsc", label: "License #", default: false },
  { key: "chainOfCustody", label: "Chain of Custody", default: false },
  { key: "inputClaim", label: "Input Claim", default: false },
  { key: "outputClaim", label: "Output Claim", default: false },
];

interface ClientData {
  id: number;
  name: string;
  contactEmail: string | null;
  accessToken: string;
}

export default function SendReportPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);

  const [client, setClient] = useState<ClientData | null>(null);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [format, setFormat] = useState<"excel" | "pdf" | "both">("excel");
  const [columns, setColumns] = useState<Set<string>>(
    new Set(reportColumns.filter((c) => c.default).map((c) => c.key))
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; data: (string | number | null)[][]; totalRows: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/preview-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, columns: Array.from(columns), filter }),
      });
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    fetch(`/api/client/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data);
        setEmail(data.contactEmail || "");
        setSubject(`Shipment Report - ${data.name}`);
        setMessage(
          `Dear ${data.name} team,\n\nPlease find the updated shipment report attached.\n\nBest regards,\nEduardo Bazua\nBZA International Services`
        );
      })
      .catch(() => {});
  }, [clientId]);

  async function handleDownloadPdf() {
    setLoadingPdf(true);
    try {
      const res = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, filter, columns: Array.from(columns) }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleDownloadExcel() {
    setLoadingExcel(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: Array.from(columns), filters: { clientId, filter } }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `BZA_Report_${client?.name.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setLoadingExcel(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          email,
          subject,
          message,
          columns: Array.from(columns),
          format,
          filter,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: `Report sent to ${email}` });
      } else {
        setResult({ ok: false, msg: data.error || "Error sending report" });
      }
    } catch {
      setResult({ ok: false, msg: "Connection error" });
    } finally {
      setSending(false);
    }
  }

  function selectAll() {
    setColumns(new Set(reportColumns.map((c) => c.key)));
  }

  function selectDefaults() {
    setColumns(new Set(reportColumns.filter((c) => c.default).map((c) => c.key)));
  }

  if (!client) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground mb-2">
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold">Send Report</h1>
        <p className="text-sm text-muted-foreground">Client: {client.name}</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
        <p className="text-sm font-medium">Filter</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="filter"
              value="active"
              checked={filter === "active"}
              onChange={() => setFilter("active")}
            />
            <span className="text-sm">Active shipments only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="filter"
              value="all"
              checked={filter === "all"}
              onChange={() => setFilter("all")}
            />
            <span className="text-sm">All shipments</span>
          </label>
        </div>
      </div>

      {/* Column selector */}
      <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Columns ({columns.size} selected)</p>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-primary hover:underline">Select All</button>
            <button onClick={selectDefaults} className="text-xs text-muted-foreground hover:underline">Defaults</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {reportColumns.map((col) => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.has(col.key)}
                onChange={() => {
                  const next = new Set(columns);
                  if (next.has(col.key)) next.delete(col.key);
                  else next.add(col.key);
                  setColumns(next);
                }}
                className="rounded"
              />
              <span className="text-xs">{col.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Send format */}
      <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
        <p className="text-sm font-medium">Attachment Format</p>
        <div className="flex gap-4">
          {([
            { value: "excel", label: "Excel only" },
            { value: "pdf", label: "PDF only" },
            { value: "both", label: "Both (Excel + PDF)" },
          ] as const).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Email fields */}
      <div className="bg-white rounded-md shadow-sm p-4 space-y-3">
        <p className="text-sm font-medium">Email</p>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" placeholder="email@client.com" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePreview}
          disabled={loadingPreview || columns.size === 0}
          className="border border-border px-5 py-3 rounded-lg font-medium text-sm hover:bg-muted disabled:opacity-50"
        >
          {loadingPreview ? "Loading..." : "Preview Table"}
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={loadingPdf || columns.size === 0}
          className="border border-border px-5 py-3 rounded-lg font-medium text-sm hover:bg-muted disabled:opacity-50"
        >
          {loadingPdf ? "Generating..." : "Download PDF"}
        </button>
        <button
          onClick={handleDownloadExcel}
          disabled={loadingExcel || columns.size === 0}
          className="border border-border px-5 py-3 rounded-lg font-medium text-sm hover:bg-muted disabled:opacity-50"
        >
          {loadingExcel ? "Generating..." : "Download Excel"}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !email || columns.size === 0}
          className="bg-primary text-primary-foreground px-5 py-3 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Report"}
        </button>
      </div>

      {/* Preview table */}
      {preview && (
        <div className="bg-white rounded-md shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Report Preview</h3>
              <p className="text-xs text-muted-foreground">{preview.totalRows} rows &middot; {preview.headers.length} columns</p>
            </div>
            <button onClick={() => setPreview(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="text-left p-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row, ri) => (
                  <tr key={ri} className="border-t border-border/50 hover:bg-muted/30">
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-2 text-xs whitespace-nowrap">
                        {cell !== null && cell !== undefined ? String(cell) : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg p-4 ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
