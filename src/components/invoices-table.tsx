"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "@/server/actions";
import { InvoiceForm } from "@/components/invoice-form";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  shipmentStatusLabels,
  shipmentStatusColors,
  paymentStatusLabels,
  paymentStatusColors,
} from "@/lib/utils";

type InvoiceRow = {
  invoice: {
    id: number;
    invoiceNumber: string;
    purchaseOrderId: number;
    quantityTons: number;
    unit: string;
    sellPriceOverride: number | null;
    buyPriceOverride: number | null;
    shipmentDate: string | null;
    estimatedArrival: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    paymentTermsDays: number | null;
    shipmentStatus: "programado" | "en_transito" | "en_aduana" | "entregado";
    customerPaymentStatus: "paid" | "unpaid";
    supplierPaymentStatus: "paid" | "unpaid";
    usesFactoring: boolean;
    freightCost: number | null;
    item: string | null;
    notes: string | null;
    destination: string | null;
  };
  poNumber: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPaymentTermsDays: number | null;
  poSellPrice: number | null;
  poBuyPrice: number | null;
  product: string | null;
  transportType: string | null;
  terms: string | null;
};

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

type Doc = { id: number; fileName: string; type: string };

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function computeDueDate(row: InvoiceRow): string | null {
  const termsDays =
    row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays
      : row.clientPaymentTermsDays != null && row.clientPaymentTermsDays > 0
      ? row.clientPaymentTermsDays
      : 60;
  const baseDate = row.invoice.invoiceDate || row.invoice.shipmentDate;
  return (
    row.invoice.dueDate ||
    (baseDate
      ? (() => {
          const d = new Date(baseDate + "T12:00:00");
          d.setDate(d.getDate() + termsDays);
          return d.toISOString().split("T")[0];
        })()
      : null)
  );
}

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "send">("view");
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedRow = rows.find((r) => r.invoice.id === selectedId) ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function openPanel(row: InvoiceRow, mode: "view" | "edit" | "send" = "view") {
    setSelectedId(row.invoice.id);
    setPanelMode(mode);
    setOpenDropdownId(null);
    if (mode === "view") loadLogs(row.invoice.invoiceNumber);
    if (mode === "send") openSend(row);
  }

  function closePanel() {
    setSelectedId(null);
    setPanelMode("view");
    setEmailLogs([]);
    setDocs([]);
  }

  async function loadLogs(invoiceNumber: string) {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/invoice-email-logs?invoiceNumber=${encodeURIComponent(invoiceNumber)}`);
      if (res.ok) setEmailLogs(await res.json());
    } finally {
      setLogsLoading(false);
    }
  }

  async function openSend(row: InvoiceRow) {
    setSendTo(row.clientEmail || "");
    setSendCc("");
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?invoiceId=${row.invoice.id}`);
      if (res.ok) {
        const all: Doc[] = await res.json();
        const blPl = all.filter((d) => d.type === "bl" || d.type === "pl");
        setDocs(blPl);
        setSelectedDocIds(blPl.map((d) => d.id));
      }
    } finally {
      setDocsLoading(false);
    }
  }

  function toggleDoc(id: number) {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSend() {
    if (!selectedRow || !sendTo) return;
    setSendLoading(true);
    const res = await fetch("/api/invoice-pdf/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: selectedRow.invoice.invoiceNumber,
        to: sendTo,
        cc: sendCc || undefined,
        documentIds: selectedDocIds,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Sent! ${data.attachmentCount} attachment(s) delivered.`);
      setPanelMode("view");
      loadLogs(selectedRow.invoice.invoiceNumber);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Error sending email");
    }
    setSendLoading(false);
  }

  function handleDelete(invoice: InvoiceRow["invoice"]) {
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}?`)) return;
    setOpenDropdownId(null);
    startTransition(async () => {
      await deleteInvoice(invoice.id);
      if (selectedId === invoice.id) closePanel();
      router.refresh();
    });
  }

  return (
    <div className="relative flex gap-0">
      {/* Table */}
      <div className={`bg-white rounded-md shadow-sm overflow-hidden transition-all duration-300 ${selectedId ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice #</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">PO</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Destination</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tons</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ship Date</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Shipment</th>
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment</th>
                <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-sm text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
                const revenue = row.invoice.quantityTons * sellPrice;
                const dueDate = computeDueDate(row);
                const today = new Date();
                let daysOverdue = 0;
                if (dueDate) {
                  daysOverdue = Math.floor(
                    (today.getTime() - new Date(dueDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)
                  );
                }
                const isOverdue = dueDate && daysOverdue > 0 && row.invoice.customerPaymentStatus === "unpaid";
                const isSelected = selectedId === row.invoice.id;

                return (
                  <tr
                    key={row.invoice.id}
                    onClick={() => openPanel(row)}
                    className={`cursor-pointer transition-colors border-t border-border ${
                      isSelected
                        ? "bg-blue-50"
                        : isOverdue
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="p-3 text-sm font-medium text-stone-800">{row.invoice.invoiceNumber}</td>
                    <td className="p-3 text-sm">
                      <Link
                        href={`/purchase-orders/${row.invoice.purchaseOrderId}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.poNumber || "-"}
                      </Link>
                    </td>
                    <td className="p-3 text-sm text-stone-700">{row.clientName || "-"}</td>
                    <td className="p-3 text-sm text-stone-500">{(row.invoice as any).destination || "-"}</td>
                    <td className="p-3 text-sm text-right tabular-nums">{formatNumber(row.invoice.quantityTons, 2)}</td>
                    <td className="p-3 text-sm text-right font-medium tabular-nums">{formatCurrency(revenue)}</td>
                    <td className="p-3 text-sm text-stone-600">{formatDate(row.invoice.shipmentDate)}</td>
                    <td className="p-3 text-sm">
                      {dueDate ? (
                        row.invoice.customerPaymentStatus === "unpaid" && daysOverdue > 0 ? (
                          <span className="text-red-600 font-medium text-xs">
                            {formatDate(dueDate)} <span className="font-bold">+{daysOverdue}d</span>
                          </span>
                        ) : (
                          <span className="text-stone-600">{formatDate(dueDate)}</span>
                        )
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${shipmentStatusColors[row.invoice.shipmentStatus] || ""}`}>
                        {shipmentStatusLabels[row.invoice.shipmentStatus] || row.invoice.shipmentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${paymentStatusColors[row.invoice.customerPaymentStatus] || ""}`}>
                        {paymentStatusLabels[row.invoice.customerPaymentStatus] || row.invoice.customerPaymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0">
                        <button
                          onClick={() => openPanel(row, "edit")}
                          className="text-xs text-primary hover:underline font-medium px-2 py-1 hover:bg-blue-50 rounded-l border border-stone-200"
                        >
                          View/Edit
                        </button>
                        <div className="relative" ref={openDropdownId === row.invoice.id ? dropdownRef : undefined}>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === row.invoice.id ? null : row.invoice.id)}
                            className="text-xs text-primary font-medium px-2 py-1 hover:bg-blue-50 rounded-r border border-l-0 border-stone-200"
                          >
                            ▼
                          </button>
                          {openDropdownId === row.invoice.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 min-w-[140px] py-1">
                              <a
                                href={`/api/invoice-pdf?invoice=${row.invoice.invoiceNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                                onClick={() => setOpenDropdownId(null)}
                              >
                                Download PDF
                              </a>
                              {!row.invoice.invoiceNumber.startsWith("PEND-") && (
                                <button
                                  onClick={() => openPanel(row, "send")}
                                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                                >
                                  Send
                                </button>
                              )}
                              {!row.invoice.invoiceNumber.startsWith("PEND-") && (
                                <button
                                  onClick={() => openPanel(row, "view")}
                                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                                >
                                  Activity
                                </button>
                              )}
                              <div className="border-t border-stone-100 my-1" />
                              <button
                                onClick={() => handleDelete(row.invoice)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Panel */}
      {selectedRow && (
        <div className="w-[360px] shrink-0 ml-4 bg-white rounded-md shadow-sm border border-stone-200 flex flex-col max-h-[calc(100vh-120px)] sticky top-4 overflow-hidden">
          {panelMode === "edit" ? (
            <div className="overflow-y-auto flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-stone-800 text-sm">
                  Edit — {selectedRow.invoice.invoiceNumber}
                </span>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-600 text-lg leading-none">×</button>
              </div>
              <InvoiceForm
                invoice={selectedRow.invoice}
                purchaseOrderId={selectedRow.invoice.purchaseOrderId}
                onCancel={() => setPanelMode("view")}
              />
            </div>
          ) : panelMode === "send" ? (
            <SendPanel
              row={selectedRow}
              docs={docs}
              docsLoading={docsLoading}
              selectedDocIds={selectedDocIds}
              toggleDoc={toggleDoc}
              sendTo={sendTo}
              sendCc={sendCc}
              setSendTo={setSendTo}
              setSendCc={setSendCc}
              sendLoading={sendLoading}
              onSend={handleSend}
              onClose={() => { setPanelMode("view"); loadLogs(selectedRow.invoice.invoiceNumber); }}
            />
          ) : (
            <ViewPanel
              row={selectedRow}
              emailLogs={emailLogs}
              logsLoading={logsLoading}
              onClose={closePanel}
              onEdit={() => setPanelMode("edit")}
              onSend={() => openSend(selectedRow).then(() => setPanelMode("send"))}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ViewPanel({
  row,
  emailLogs,
  logsLoading,
  onClose,
  onEdit,
  onSend,
}: {
  row: InvoiceRow;
  emailLogs: EmailLog[];
  logsLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSend: () => void;
}) {
  const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
  const revenue = row.invoice.quantityTons * sellPrice;
  const dueDate = computeDueDate(row);
  const today = new Date();
  let daysOverdue = 0;
  if (dueDate) {
    daysOverdue = Math.floor(
      (today.getTime() - new Date(dueDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)
    );
  }
  const isOverdue = dueDate && daysOverdue > 0 && row.invoice.customerPaymentStatus === "unpaid";

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-stone-100">
        <div>
          <p className="text-xs text-stone-500 mb-0.5">Invoice {row.invoice.invoiceNumber}</p>
          {isOverdue ? (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              Overdue {daysOverdue} days
            </span>
          ) : (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${paymentStatusColors[row.invoice.customerPaymentStatus]}`}>
              {paymentStatusLabels[row.invoice.customerPaymentStatus]}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none mt-0.5">×</button>
      </div>

      {/* Amount */}
      <div className="px-4 py-3 border-b border-stone-100">
        <p className="text-xs text-stone-500 mb-0.5">Total</p>
        <p className="text-2xl font-bold text-stone-900">{formatCurrency(revenue)}</p>
        <p className="text-xs text-stone-500 mt-0.5">{formatNumber(row.invoice.quantityTons, 2)} tons</p>
      </div>

      {/* Details */}
      <div className="px-4 py-3 border-b border-stone-100 space-y-2 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {row.invoice.invoiceDate && (
            <>
              <span className="text-stone-500">Invoice date</span>
              <span className="text-stone-800 font-medium">{formatDate(row.invoice.invoiceDate)}</span>
            </>
          )}
          {dueDate && (
            <>
              <span className="text-stone-500">Due date</span>
              <span className={`font-medium ${isOverdue ? "text-red-600" : "text-stone-800"}`}>{formatDate(dueDate)}</span>
            </>
          )}
          {row.poNumber && (
            <>
              <span className="text-stone-500">Purchase Order</span>
              <Link href={`/purchase-orders/${row.invoice.purchaseOrderId}`} className="text-primary hover:underline font-medium">
                {row.poNumber}
              </Link>
            </>
          )}
          {row.product && (
            <>
              <span className="text-stone-500">Product</span>
              <span className="text-stone-800 font-medium">{row.product}</span>
            </>
          )}
          {row.invoice.shipmentDate && (
            <>
              <span className="text-stone-500">Ship date</span>
              <span className="text-stone-800 font-medium">{formatDate(row.invoice.shipmentDate)}</span>
            </>
          )}
          {row.invoice.estimatedArrival && (
            <>
              <span className="text-stone-500">ETA</span>
              <span className="text-stone-800 font-medium">{formatDate(row.invoice.estimatedArrival)}</span>
            </>
          )}
          {(row.invoice as any).destination && (
            <>
              <span className="text-stone-500">Destination</span>
              <span className="text-stone-800 font-medium">{(row.invoice as any).destination}</span>
            </>
          )}
          <>
            <span className="text-stone-500">Shipment</span>
            <span className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-medium ${shipmentStatusColors[row.invoice.shipmentStatus]}`}>
              {shipmentStatusLabels[row.invoice.shipmentStatus]}
            </span>
          </>
        </div>

        {/* Client */}
        {row.clientName && (
          <div className="pt-2 border-t border-stone-100">
            <p className="text-xs text-stone-500 mb-0.5">Client</p>
            <p className="text-sm font-semibold text-stone-800">{row.clientName}</p>
            {row.clientEmail && <p className="text-xs text-stone-500">{row.clientEmail}</p>}
          </div>
        )}

        {/* Invoice activity */}
        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs font-semibold text-stone-700 mb-2">Invoice activity</p>
          {logsLoading ? (
            <p className="text-xs text-stone-400">Loading...</p>
          ) : emailLogs.length === 0 ? (
            <p className="text-xs text-stone-400 italic">Never sent.</p>
          ) : (
            <div className="space-y-2">
              {emailLogs.map((log, i) => (
                <div key={log.id} className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${(log.openCount ?? 0) > 0 ? "bg-emerald-500" : "bg-stone-300"}`} />
                    {i < emailLogs.length - 1 && <div className="w-px flex-1 bg-stone-200 my-0.5" />}
                  </div>
                  <div className="pb-2 flex-1">
                    <p className="text-xs font-medium text-stone-700">
                      {(log.openCount ?? 0) > 0 ? `Viewed ${log.openCount} time${log.openCount === 1 ? "" : "s"}` : "Sent"}
                    </p>
                    <p className="text-[10px] text-stone-400">{fmtDateTime(log.sentAt)}</p>
                    <p className="text-[10px] text-stone-500">To: {log.sentTo}</p>
                    {log.firstOpenedAt && (
                      <p className="text-[10px] text-stone-400">Last viewed: {fmtDateTime(log.lastOpenedAt)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-stone-100 flex gap-2">
        <a
          href={`/api/invoice-pdf?invoice=${row.invoice.invoiceNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium"
        >
          PDF
        </a>
        {!row.invoice.invoiceNumber.startsWith("PEND-") && (
          <button
            onClick={onSend}
            className="flex-1 text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium"
          >
            Send
          </button>
        )}
        <button
          onClick={onEdit}
          className="flex-1 text-xs bg-primary text-white px-3 py-2 rounded hover:opacity-90 font-medium"
        >
          Edit invoice
        </button>
      </div>
    </>
  );
}

function SendPanel({
  row,
  docs,
  docsLoading,
  selectedDocIds,
  toggleDoc,
  sendTo,
  sendCc,
  setSendTo,
  setSendCc,
  sendLoading,
  onSend,
  onClose,
}: {
  row: InvoiceRow;
  docs: Doc[];
  docsLoading: boolean;
  selectedDocIds: number[];
  toggleDoc: (id: number) => void;
  sendTo: string;
  sendCc: string;
  setSendTo: (v: string) => void;
  setSendCc: (v: string) => void;
  sendLoading: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-stone-100">
        <span className="font-semibold text-stone-800 text-sm">Send — {row.invoice.invoiceNumber}</span>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
      </div>
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">To</label>
          <input
            type="email"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="recipient@example.com"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">CC (optional)</label>
          <input
            type="email"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="cc@example.com"
            value={sendCc}
            onChange={(e) => setSendCc(e.target.value)}
          />
        </div>

        {/* Attachments */}
        <div>
          <p className="text-xs font-medium text-stone-600 mb-2">Attachments</p>
          <div className="bg-stone-50 rounded border border-stone-200 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-default">
              <input type="checkbox" checked readOnly className="w-3.5 h-3.5" />
              <span className="text-xs text-stone-700">Invoice PDF</span>
            </label>
            {docsLoading ? (
              <p className="text-xs text-stone-400 pl-5">Loading documents...</p>
            ) : docs.length > 0 ? (
              docs.map((d) => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={selectedDocIds.includes(d.id)}
                    onChange={() => toggleDoc(d.id)}
                  />
                  <span className="text-xs text-stone-700">{d.fileName}</span>
                  <span className="text-[10px] text-stone-400 uppercase">{d.type}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-stone-400 pl-5">No BOL/PL uploaded</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-stone-100 flex gap-2">
        <button onClick={onClose} className="flex-1 text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium">
          Cancel
        </button>
        <button
          onClick={onSend}
          disabled={sendLoading || !sendTo}
          className="flex-1 text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {sendLoading ? "Sending..." : "Send invoice"}
        </button>
      </div>
    </>
  );
}
