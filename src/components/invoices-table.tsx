"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteInvoice, markInvoicesPaid, duplicateInvoice, markInvoiceUnpaid, updateInvoice } from "@/server/actions";
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
  clientId: number | null;
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

type UnpaidInvoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  shipmentDate: string | null;
  dueDate: string | null;
  paymentTermsDays: number | null;
  quantityTons: number;
  sellPriceOverride: number | null;
  poSellPrice: number | null;
  clientPaymentTermsDays: number | null;
};

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    (() => { const p = iso.split("T")[0].split("-"); return `${p[1].padStart(2,"0")}/${p[2].padStart(2,"0")}/${p[0]}`; })() +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function computeDueDate(
  invoiceDate: string | null,
  shipmentDate: string | null,
  dueDate: string | null,
  paymentTermsDays: number | null,
  clientPaymentTermsDays: number | null
): string | null {
  const termsDays =
    paymentTermsDays != null && paymentTermsDays > 0
      ? paymentTermsDays
      : clientPaymentTermsDays != null && clientPaymentTermsDays > 0
      ? clientPaymentTermsDays
      : 60;
  const baseDate = invoiceDate || shipmentDate;
  return (
    dueDate ||
    (baseDate
      ? (() => {
          const d = new Date(baseDate + "T12:00:00");
          d.setDate(d.getDate() + termsDays);
          return d.toISOString().split("T")[0];
        })()
      : null)
  );
}

function computeRowDueDate(row: InvoiceRow): string | null {
  return computeDueDate(
    row.invoice.invoiceDate,
    row.invoice.shipmentDate,
    row.invoice.dueDate,
    row.invoice.paymentTermsDays,
    row.clientPaymentTermsDays
  );
}

export function InvoicesTable({ rows }: { rows: InvoiceRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "send" | "payment">("view");
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [viewDocs, setViewDocs] = useState<Doc[]>([]);
  const [viewDocsLoading, setViewDocsLoading] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  // Receive payment state
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [paymentClientId, setPaymentClientId] = useState<number | null>(null);
  const [paymentClientName, setPaymentClientName] = useState("");
  const [paymentPreSelectedId, setPaymentPreSelectedId] = useState<number | null>(null);
  const [statusDropdownId, setStatusDropdownId] = useState<number | null>(null);
  const [statusDropdownPos, setStatusDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [actionDropdownPos, setActionDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedRow = rows.find((r) => r.invoice.id === selectedId) ?? null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
      if (statusDropdownId !== null && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusDropdownId]);

  function openPanel(row: InvoiceRow, mode: "view" | "edit" | "send" | "payment" = "view") {
    setSelectedId(row.invoice.id);
    setPanelMode(mode);
    setOpenDropdownId(null);
    if (mode === "view") { loadLogs(row.invoice.invoiceNumber); loadViewDocs(row.invoice.id); }
    if (mode === "send") openSend(row);
    if (mode === "payment") openPayment(row);
  }

  function closePanel() {
    setSelectedId(null);
    setPanelMode("view");
    setEmailLogs([]);
    setDocs([]);
    setViewDocs([]);
    setUnpaidInvoices([]);
  }

  async function loadViewDocs(invoiceId: number) {
    setViewDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?invoiceId=${invoiceId}`);
      if (res.ok) setViewDocs(await res.json());
    } finally {
      setViewDocsLoading(false);
    }
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

  async function openPayment(row: InvoiceRow, preSelectId?: number) {
    if (!row.clientId) return;
    setPaymentClientId(row.clientId);
    setPaymentClientName(row.clientName || "");
    setPaymentPreSelectedId(preSelectId ?? row.invoice.id);
    setUnpaidLoading(true);
    try {
      const res = await fetch(`/api/client-unpaid-invoices?clientId=${row.clientId}`);
      if (res.ok) setUnpaidInvoices(await res.json());
    } finally {
      setUnpaidLoading(false);
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
    <div className="relative flex gap-4 items-start">
      {/* Table */}
      <div className={`bg-white rounded-md shadow-sm transition-all duration-300 ${selectedId ? "flex-1 min-w-0" : "w-full"}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Invoice #</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">PO</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Destination</th>
                <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tons</th>
                <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Revenue</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ship Date</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Due Date</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Shipment</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Payment</th>
                <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-sm text-muted-foreground">No invoices found.</td>
                </tr>
              )}
              {rows.map((row) => {
                const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
                const revenue = row.invoice.quantityTons * sellPrice;
                const dueDate = computeRowDueDate(row);
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
                      isSelected ? "bg-[#0d9488]" : isOverdue ? "bg-[#0d3d3b]/40 hover:bg-[#0d3d3b]/70" : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="px-3 py-1.5 text-xs font-medium text-stone-800 whitespace-nowrap">{row.invoice.invoiceNumber}</td>
                    <td className="px-3 py-1.5 text-xs">
                      <Link href={`/purchase-orders/${row.invoice.purchaseOrderId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {row.poNumber || "-"}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-stone-700">{row.clientName || "-"}</td>
                    <td className="px-3 py-1.5 text-xs text-stone-500">{(row.invoice as any).destination || "-"}</td>
                    <td className="px-3 py-1.5 text-xs text-right tabular-nums">{formatNumber(row.invoice.quantityTons, 2)}</td>
                    <td className="px-3 py-1.5 text-xs text-right font-medium tabular-nums">{formatCurrency(revenue)}</td>
                    <td className="px-3 py-1.5 text-xs text-stone-600 whitespace-nowrap">{formatDate(row.invoice.shipmentDate)}</td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                      {dueDate ? (
                        row.invoice.customerPaymentStatus === "unpaid" && daysOverdue > 0 ? (
                          <span className="text-[#0d3d3b] font-medium">{formatDate(dueDate)} <span className="font-bold">+{daysOverdue}d</span></span>
                        ) : (
                          <span className="text-stone-600">{formatDate(dueDate)}</span>
                        )
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          if (statusDropdownId === row.invoice.id) {
                            setStatusDropdownId(null);
                          } else {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            const dropdownW = 140;
                            const left = (rect.right + dropdownW + 4) > window.innerWidth
                              ? rect.left - dropdownW - 4
                              : rect.right + 4;
                            const estimatedH = 180;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow < estimatedH ? rect.top - estimatedH - 4 : rect.bottom + 4;
                            setStatusDropdownPos({ top, left: Math.max(4, left) });
                            setStatusDropdownId(row.invoice.id);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:opacity-80 whitespace-nowrap ${shipmentStatusColors[row.invoice.shipmentStatus] || ""}`}
                      >
                        {shipmentStatusLabels[row.invoice.shipmentStatus] || row.invoice.shipmentStatus} ▾
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${paymentStatusColors[row.invoice.customerPaymentStatus] || ""}`}>
                        {paymentStatusLabels[row.invoice.customerPaymentStatus] || row.invoice.customerPaymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        {row.invoice.customerPaymentStatus === "unpaid" && row.clientId && (
                          <button
                            onClick={() => openPanel(row, "payment")}
                            className="text-[11px] text-emerald-700 font-medium px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                          >
                            Pay
                          </button>
                        )}
                        <div ref={openDropdownId === row.invoice.id ? dropdownRef : undefined}>
                          <button
                            onClick={(e) => {
                              if (openDropdownId === row.invoice.id) {
                                setOpenDropdownId(null);
                              } else {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                const w = 170;
                                const estimatedH = 180;
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const top = spaceBelow < estimatedH ? rect.top - estimatedH - 4 : rect.bottom + 4;
                                setActionDropdownPos({ top, left: Math.max(4, rect.right - w) });
                                setOpenDropdownId(row.invoice.id);
                              }
                            }}
                            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors text-base leading-none"
                            title="More actions"
                          >
                            ···
                          </button>
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

      {/* Action (▼) dropdown — portal-rendered to escape overflow containers */}
      {openDropdownId !== null && actionDropdownPos && (() => {
        const activeRow = rows.find((r) => r.invoice.id === openDropdownId);
        if (!activeRow) return null;
        return createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: actionDropdownPos.top, left: actionDropdownPos.left, zIndex: 9999 }}
            className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[160px] py-1"
          >
            <button onClick={() => { openPanel(activeRow, "edit"); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">View/Edit</button>
            <a href={`/api/invoice-pdf?invoice=${activeRow.invoice.invoiceNumber}`} target="_blank" rel="noopener noreferrer" className="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpenDropdownId(null)}>Print</a>
            {!activeRow.invoice.invoiceNumber.startsWith("PEND-") && (
              <button onClick={() => { openPanel(activeRow, "send"); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Send</button>
            )}
            <button onClick={async () => { setOpenDropdownId(null); await duplicateInvoice(activeRow.invoice.id); router.refresh(); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Duplicate</button>
            {activeRow.invoice.customerPaymentStatus === "paid" && (
              <button onClick={async () => { setOpenDropdownId(null); await markInvoiceUnpaid(activeRow.invoice.id); router.refresh(); }} className="w-full text-left px-4 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]">Mark as Unpaid</button>
            )}
            <div className="border-t border-stone-100 my-1" />
            <button onClick={() => { handleDelete(activeRow.invoice); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-[#0d3d3b] hover:bg-[#0d3d3b]">Delete</button>
          </div>,
          document.body
        );
      })()}

      {/* Status dropdown — portal-rendered to escape overflow-x-auto */}
      {statusDropdownId !== null && statusDropdownPos && createPortal(
        <div
          ref={statusDropdownRef}
          style={{ position: "fixed", top: statusDropdownPos.top, left: statusDropdownPos.left, zIndex: 9999 }}
          className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[130px] py-1"
        >
          {(["programado", "en_transito", "en_aduana", "entregado"] as const).map((s) => {
            const currentRow = rows.find((r) => r.invoice.id === statusDropdownId);
            return (
              <button
                key={s}
                onClick={async () => {
                  setStatusDropdownId(null);
                  await updateInvoice(statusDropdownId, { shipmentStatus: s });
                  router.refresh();
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 ${currentRow?.invoice.shipmentStatus === s ? "font-semibold text-primary" : "text-stone-700"}`}
              >
                {shipmentStatusLabels[s]}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* Side Panel */}
      {selectedRow && (
        <div className="w-[380px] shrink-0 bg-white rounded-md shadow-sm border border-stone-200 flex flex-col max-h-[calc(100vh-120px)] sticky top-4 overflow-hidden">
          {panelMode === "edit" ? (
            <div className="overflow-y-auto flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-stone-800 text-sm">Edit — {selectedRow.invoice.invoiceNumber}</span>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
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
          ) : panelMode === "payment" ? (
            <ReceivePaymentPanel
              clientId={paymentClientId!}
              clientName={paymentClientName}
              unpaidInvoices={unpaidInvoices}
              loading={unpaidLoading}
              preSelectedId={paymentPreSelectedId}
              onClose={closePanel}
              onSaved={() => { closePanel(); router.refresh(); }}
            />
          ) : (
            <ViewPanel
              row={selectedRow}
              emailLogs={emailLogs}
              logsLoading={logsLoading}
              attachments={viewDocs}
              attachmentsLoading={viewDocsLoading}
              onClose={closePanel}
              onEdit={() => setPanelMode("edit")}
              onSend={() => {
                // Pre-populate from already-loaded viewDocs if available
                if (viewDocs.length > 0) {
                  setSendTo(selectedRow.clientEmail || "");
                  setSendCc("");
                  const blPl = viewDocs.filter((d) => d.type === "bl" || d.type === "pl");
                  setDocs(blPl);
                  setSelectedDocIds(blPl.map((d) => d.id));
                  setPanelMode("send");
                } else {
                  openSend(selectedRow).then(() => setPanelMode("send"));
                }
              }}
              onPayment={() => openPayment(selectedRow).then(() => setPanelMode("payment"))}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Receive Payment Panel ────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "cv_credit", label: "CV Credit" },
  { value: "xepellin", label: "Xepellin" },
  { value: "factoraje_bbva", label: "Factoraje BBVA" },
  { value: "biopappel_scribe", label: "Biopappel Scribe" },
  { value: "other", label: "Other..." },
];

function ReceivePaymentPanel({
  clientId,
  clientName,
  unpaidInvoices,
  loading,
  preSelectedId,
  onClose,
  onSaved,
}: {
  clientId: number;
  clientName: string;
  unpaidInvoices: UnpaidInvoice[];
  loading: boolean;
  preSelectedId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    preSelectedId ? [preSelectedId] : []
  );
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("wire_transfer");
  const [customMethod, setCustomMethod] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleInvoice(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    if (selectedIds.length === unpaidInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unpaidInvoices.map((i) => i.id));
    }
  }

  const selectedInvoices = unpaidInvoices.filter((inv) => selectedIds.includes(inv.id));

  const totalSelected = selectedInvoices.reduce((sum, inv) => {
    const price = inv.sellPriceOverride ?? inv.poSellPrice ?? 0;
    return sum + inv.quantityTons * price;
  }, 0);

  async function handleSave() {
    if (selectedIds.length === 0 || !paymentDate) return;
    const finalMethod = paymentMethod === "other" ? (customMethod || "other") : paymentMethod;
    const invoiceAmounts = selectedInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.quantityTons * (inv.sellPriceOverride ?? inv.poSellPrice ?? 0),
    }));
    setSaving(true);
    try {
      await markInvoicesPaid(selectedIds, paymentDate, finalMethod, referenceNo, clientId, invoiceAmounts);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-bold text-stone-900">Receive Payment</span>
          </div>
          <p className="text-xs text-stone-500">{clientName}</p>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none mt-0.5">×</button>
      </div>

      {/* Payment fields */}
      <div className="px-4 py-3 border-b border-stone-100 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Payment date</label>
            <input
              type="date"
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Reference no.</label>
            <input
              type="text"
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Optional"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Payment method</label>
          <select
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {paymentMethod === "other" && (
            <input
              type="text"
              className="mt-2 w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe payment method"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Amount received */}
      {selectedIds.length > 0 && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <span className="text-xs text-emerald-700 font-medium">Amount received</span>
          <span className="text-lg font-bold text-emerald-800">{formatCurrency(totalSelected)}</span>
        </div>
      )}

      {/* Outstanding invoices */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Outstanding Transactions</span>
          {!loading && unpaidInvoices.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-primary hover:underline">
              {selectedIds.length === unpaidInvoices.length ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-stone-400">Loading...</div>
        ) : unpaidInvoices.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-400 italic">No outstanding invoices.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="w-8 p-2 text-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={selectedIds.length === unpaidInvoices.length && unpaidInvoices.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="text-left p-2 font-medium text-stone-500">Invoice</th>
                <th className="text-left p-2 font-medium text-stone-500">Due</th>
                <th className="text-right p-2 font-medium text-stone-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {unpaidInvoices.map((inv) => {
                const price = inv.sellPriceOverride ?? inv.poSellPrice ?? 0;
                const amount = inv.quantityTons * price;
                const due = computeDueDate(
                  inv.invoiceDate,
                  inv.shipmentDate,
                  inv.dueDate,
                  inv.paymentTermsDays,
                  inv.clientPaymentTermsDays
                );
                const today = new Date();
                const daysOverdue = due
                  ? Math.floor((today.getTime() - new Date(due + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                const isChecked = selectedIds.includes(inv.id);

                return (
                  <tr
                    key={inv.id}
                    onClick={() => toggleInvoice(inv.id)}
                    className={`border-b border-stone-50 cursor-pointer transition-colors ${isChecked ? "bg-emerald-50/60" : "hover:bg-stone-50"}`}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5"
                        checked={isChecked}
                        onChange={() => toggleInvoice(inv.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-2">
                      <p className="font-medium text-stone-800">{inv.invoiceNumber}</p>
                      {inv.invoiceDate && <p className="text-[10px] text-stone-400">{formatDate(inv.invoiceDate)}</p>}
                    </td>
                    <td className="p-2">
                      {due ? (
                        daysOverdue > 0 ? (
                          <span className="text-[#0d3d3b] font-semibold">{formatDate(due)}<br /><span className="text-[10px]">+{daysOverdue}d overdue</span></span>
                        ) : (
                          <span className="text-stone-600">{formatDate(due)}</span>
                        )
                      ) : "-"}
                    </td>
                    <td className="p-2 text-right font-medium text-stone-800">{formatCurrency(amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-stone-100 space-y-2">
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between text-xs text-stone-600 px-1">
            <span>{selectedIds.length} invoice{selectedIds.length !== 1 ? "s" : ""} selected</span>
            <span className="font-bold text-stone-800">{formatCurrency(totalSelected)}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0 || !paymentDate}
            className="flex-1 text-xs bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : `Save payment${selectedIds.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── View Panel ───────────────────────────────────────────────────────────────

function ViewPanel({
  row,
  emailLogs,
  logsLoading,
  attachments,
  attachmentsLoading,
  onClose,
  onEdit,
  onSend,
  onPayment,
}: {
  row: InvoiceRow;
  emailLogs: EmailLog[];
  logsLoading: boolean;
  attachments: Doc[];
  attachmentsLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSend: () => void;
  onPayment: () => void;
}) {
  const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
  const revenue = row.invoice.quantityTons * sellPrice;
  const dueDate = computeRowDueDate(row);
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
      <div className="flex items-start justify-between p-4 border-b border-stone-100">
        <div>
          <p className="text-xs text-stone-500 mb-0.5">Invoice {row.invoice.invoiceNumber}</p>
          {isOverdue ? (
            <span className="text-xs font-semibold text-[#0d3d3b] bg-[#0d3d3b] px-2 py-0.5 rounded-full">Overdue {daysOverdue} days</span>
          ) : (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${paymentStatusColors[row.invoice.customerPaymentStatus]}`}>
              {paymentStatusLabels[row.invoice.customerPaymentStatus]}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none mt-0.5">×</button>
      </div>

      <div className="px-4 py-3 border-b border-stone-100">
        <p className="text-xs text-stone-500 mb-0.5">Total</p>
        <p className="text-2xl font-bold text-stone-900">{formatCurrency(revenue)}</p>
        <p className="text-xs text-stone-500 mt-0.5">{formatNumber(row.invoice.quantityTons, 2)} tons</p>
      </div>

      <div className="px-4 py-3 border-b border-stone-100 flex-1 overflow-y-auto space-y-2">
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
              <span className={`font-medium ${isOverdue ? "text-[#0d3d3b]" : "text-stone-800"}`}>{formatDate(dueDate)}</span>
            </>
          )}
          {row.poNumber && (
            <>
              <span className="text-stone-500">Purchase Order</span>
              <Link href={`/purchase-orders/${row.invoice.purchaseOrderId}`} className="text-primary hover:underline font-medium">{row.poNumber}</Link>
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

        {row.clientName && (
          <div className="pt-2 border-t border-stone-100">
            <p className="text-xs text-stone-500 mb-0.5">Client</p>
            <p className="text-sm font-semibold text-stone-800">{row.clientName}</p>
            {row.clientEmail && <p className="text-xs text-stone-500">{row.clientEmail}</p>}
          </div>
        )}

        {/* Attachments */}
        <div className="pt-2 border-t border-stone-100">
          <p className="text-xs font-semibold text-stone-700 mb-2">Attachments</p>
          {attachmentsLoading ? (
            <p className="text-xs text-stone-400">Loading...</p>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-stone-400 italic">No attachments.</p>
          ) : (
            <div className="space-y-1">
              {attachments.map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/documents/download/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-stone-50 group"
                >
                  <svg className="w-3.5 h-3.5 text-[#5eead4] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span className="text-xs text-primary hover:underline flex-1 truncate">{doc.fileName}</span>
                </a>
              ))}
            </div>
          )}
        </div>

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

      <div className="p-3 border-t border-stone-100 space-y-2">
        {row.invoice.customerPaymentStatus === "unpaid" && row.clientId && (
          <button
            onClick={onPayment}
            className="w-full text-xs bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700 font-medium"
          >
            Receive payment
          </button>
        )}
        <div className="flex gap-2">
          <a
            href={`/api/invoice-pdf?invoice=${row.invoice.invoiceNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium"
          >
            PDF
          </a>
          {!row.invoice.invoiceNumber.startsWith("PEND-") && (
            <button onClick={onSend} className="flex-1 text-xs border border-stone-300 text-stone-700 px-3 py-2 rounded hover:bg-stone-50 font-medium">
              Send
            </button>
          )}
          <button onClick={onEdit} className="flex-1 text-xs bg-primary text-white px-3 py-2 rounded hover:opacity-90 font-medium">
            Edit invoice
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Send Panel ───────────────────────────────────────────────────────────────

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
                  <input type="checkbox" className="w-3.5 h-3.5" checked={selectedDocIds.includes(d.id)} onChange={() => toggleDoc(d.id)} />
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
          className="flex-1 text-xs bg-[#0d9488] text-white px-3 py-2 rounded hover:bg-[#0d9488] disabled:opacity-50 font-medium"
        >
          {sendLoading ? "Sending..." : "Send invoice"}
        </button>
      </div>
    </>
  );
}
