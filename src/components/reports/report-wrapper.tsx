"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Mail, Settings2, X, Check, RotateCcw, ChevronDown, FileText, Table2, FileSpreadsheet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ColDef = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  defaultVisible?: boolean;
  format?: "text" | "currency" | "date" | "number" | "percent" | "status";
};

export type ReportWrapperProps = {
  reportId: string;
  title: string;
  subtitle?: string;
  dateLabel?: string;
  columns: ColDef[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  totalsLabel?: string;
  groupBy?: string;
};

// ── Formatting ─────────────────────────────────────────────────────────────────

function formatCell(value: unknown, format: ColDef["format"]): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "currency":
      return typeof value === "number" ? formatCurrency(value) : String(value);
    case "date":
      return typeof value === "string" ? formatDate(value) : String(value);
    case "number":
      return typeof value === "number"
        ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value);
    case "percent":
      return typeof value === "number" ? value.toFixed(1) + "%" : String(value);
    case "status":
      return value ? String(value).replace(/_/g, " ") : "—";
    case "text":
    default:
      return value !== undefined && value !== null ? String(value) : "—";
  }
}

function alignClass(align?: ColDef["align"]): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

// ── localStorage key ───────────────────────────────────────────────────────────

function storageKey(reportId: string) {
  return `bza_cols_${reportId}`;
}

function defaultVisible(columns: ColDef[]): string[] {
  return columns
    .filter((c) => c.defaultVisible !== false)
    .map((c) => c.key);
}

// ── Toast ──────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: "success" | "error" } | null;

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        toast.type === "success"
          ? "bg-stone-800 text-white"
          : "bg-red-700 text-white"
      }`}
    >
      {toast.type === "success" ? (
        <Check className="w-4 h-4 flex-shrink-0" />
      ) : (
        <X className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Email Modal ────────────────────────────────────────────────────────────────

function EmailModal({
  defaultSubject,
  onClose,
  onSend,
  isSending,
}: {
  defaultSubject: string;
  onClose: () => void;
  onSend: (to: string, subject: string, message: string) => void;
  isSending: boolean;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) return;
    onSend(to.trim(), subject.trim() || defaultSubject, message.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Send Report by Email</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800 placeholder:text-stone-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Message <span className="text-stone-400">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a personal message..."
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800 placeholder:text-stone-400 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !to.trim()}
              className="px-4 py-2 text-sm font-medium bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customize Dropdown ─────────────────────────────────────────────────────────

function CustomizeDropdown({
  columns,
  visibleKeys,
  onToggle,
  onReset,
  onClose,
}: {
  columns: ColDef[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const visibleCount = visibleKeys.length;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-xl shadow-xl w-56 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
          Columns
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {columns.map((col) => {
          const isChecked = visibleKeys.includes(col.key);
          const isLastVisible = isChecked && visibleCount === 1;
          return (
            <label
              key={col.key}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm cursor-pointer select-none transition-colors ${
                isLastVisible
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-stone-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isLastVisible}
                onChange={() => !isLastVisible && onToggle(col.key)}
                className="w-4 h-4 rounded border-stone-300 accent-stone-700"
              />
              <span className="text-stone-700">{col.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Group helpers ──────────────────────────────────────────────────────────────

function groupRows(
  rows: Record<string, unknown>[],
  groupBy: string
): { groupKey: string; rows: Record<string, unknown>[] }[] {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = row[groupBy] !== undefined && row[groupBy] !== null ? String(row[groupBy]) : "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries()).map(([groupKey, rows]) => ({ groupKey, rows }));
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ReportWrapper({
  reportId,
  title,
  subtitle,
  dateLabel,
  columns,
  rows,
  totals,
  totalsLabel,
  groupBy,
}: ReportWrapperProps) {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => defaultVisible(columns));
  const [hydrated, setHydrated] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [isPdfPending, startPdfTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();
  const [showDownload, setShowDownload] = useState(false);

  const customizeBtnRef = useRef<HTMLDivElement>(null);
  const downloadBtnRef  = useRef<HTMLDivElement>(null);

  // Close download dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (downloadBtnRef.current && !downloadBtnRef.current.contains(e.target as Node)) {
        setShowDownload(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(storageKey(reportId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only keep keys that are still valid columns
          const validKeys = new Set(columns.map((c) => c.key));
          const filtered = parsed.filter((k) => validKeys.has(k));
          if (filtered.length > 0) {
            setVisibleKeys(filtered);
          }
        }
      } catch {
        // ignore malformed
      }
    }
    setHydrated(true);
  }, [reportId, columns]);

  // Persist to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(reportId), JSON.stringify(visibleKeys));
  }, [visibleKeys, reportId, hydrated]);

  const visibleCols = columns.filter((c) => visibleKeys.includes(c.key));

  function handleToggle(key: string) {
    setVisibleKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((k) => k !== key);
      } else {
        // Restore in original column order
        const order = columns.map((c) => c.key);
        return order.filter((k) => k === key || prev.includes(k));
      }
    });
  }

  function handleReset() {
    setVisibleKeys(defaultVisible(columns));
  }

  // ── Build payload ────────────────────────────────────────────────────────────

  function buildPayload() {
    return {
      title,
      subtitle,
      dateLabel,
      columns: visibleCols.map((c) => ({
        key: c.key,
        label: c.label,
        align: c.align,
        format: c.format,
      })),
      rows,
      totals,
      totalsLabel,
    };
  }

  // ── PDF download ─────────────────────────────────────────────────────────────

  function handleDownloadPdf() {
    startPdfTransition(async () => {
      try {
        const res = await fetch("/api/reports/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) {
          const text = await res.text();
          setToast({ message: `PDF failed: ${text.slice(0, 120)}`, type: "error" });
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9_\- ]/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        setToast({ message: `PDF error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
      }
    });
  }

  // ── Excel download ───────────────────────────────────────────────────────────

  function handleDownloadExcel() {
    const header = visibleCols.map(c => c.label);
    const dataRows = rows.map(row => visibleCols.map(col => {
      const v = row[col.key];
      if (v === null || v === undefined) return "";
      if (col.format === "currency" && typeof v === "number") return v;
      if (col.format === "number" && typeof v === "number") return v;
      if (col.format === "percent" && typeof v === "number") return v / 100; // Excel % format
      return formatCell(v, col.format);
    }));
    if (totals && totalsLabel) {
      dataRows.push(visibleCols.map((col, i) => {
        if (i === 0) return totalsLabel ?? "TOTAL";
        const v = totals[col.key];
        if (v !== undefined && v !== null && typeof v === "number") return v;
        return "";
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title.replace(/[^a-zA-Z0-9_\- ]/g, "_")}.xlsx`);
  }

  // ── CSV download ──────────────────────────────────────────────────────────────

  function handleDownloadCsv() {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : formatCell(v, undefined);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push(visibleCols.map(c => escape(c.label)).join(","));
    for (const row of rows) {
      lines.push(visibleCols.map(col => escape(formatCell(row[col.key], col.format))).join(","));
    }
    if (totals && totalsLabel) {
      lines.push(visibleCols.map((col, i) => {
        if (i === 0) return escape(totalsLabel);
        const v = totals[col.key];
        return v !== undefined && v !== null ? escape(formatCell(v, col.format)) : "";
      }).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_\- ]/g, "_")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ── Email send ───────────────────────────────────────────────────────────────

  function handleSendEmail(to: string, subject: string, message: string) {
    startEmailTransition(async () => {
      try {
        const res = await fetch("/api/reports/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...buildPayload(), to, subject, message }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setToast({ message: json.error ?? "Failed to send email", type: "error" });
        } else {
          setToast({ message: `Report sent to ${to}`, type: "success" });
          setShowEmailModal(false);
        }
      } catch (err) {
        setToast({ message: `Email error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
      }
    });
  }

  // ── Grouped rendering ────────────────────────────────────────────────────────

  const groups = groupBy ? groupRows(rows, groupBy) : null;

  const now = new Date();
  const timestampStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      {/* ── Floating Customize button (always visible on right) ── */}
      <div
        ref={customizeBtnRef}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[60] print:hidden"
      >
        <button
          onClick={() => setShowCustomize((v) => !v)}
          className="flex items-center gap-1.5 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-xs font-semibold px-3 py-2.5 rounded-l-lg shadow-lg transition-colors"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <Settings2 className="w-3.5 h-3.5" style={{ transform: "rotate(180deg)" }} />
          Customize
        </button>
        {showCustomize && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1">
            <CustomizeDropdown
              columns={columns}
              visibleKeys={visibleKeys}
              onToggle={handleToggle}
              onReset={handleReset}
              onClose={() => setShowCustomize(false)}
            />
          </div>
        )}
      </div>

      <div className="space-y-4 max-w-5xl">
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to reports
          </Link>

          <div className="flex items-center gap-2">
            {/* Download dropdown */}
            <div className="relative" ref={downloadBtnRef}>
              <button
                onClick={() => setShowDownload(v => !v)}
                disabled={isPdfPending}
                className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isPdfPending ? "Generating…" : "Download"}
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>
              {showDownload && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-xl shadow-xl w-44 overflow-hidden">
                  <button onClick={() => { setShowDownload(false); handleDownloadPdf(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                    <FileText className="w-4 h-4 text-stone-400" /> PDF
                  </button>
                  <button onClick={() => { setShowDownload(false); handleDownloadExcel(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                    <FileSpreadsheet className="w-4 h-4 text-stone-400" /> Excel (.xlsx)
                  </button>
                  <button onClick={() => { setShowDownload(false); handleDownloadCsv(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors">
                    <Table2 className="w-4 h-4 text-stone-400" /> CSV
                  </button>
                </div>
              )}
            </div>

            {/* Send Email */}
            <button
              onClick={() => setShowEmailModal(true)}
              disabled={isEmailPending}
              className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>

        {/* ── Report Card ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
          {/* Centered header block */}
          <div className="py-6 text-center border-b border-stone-100">
            {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
            <h2 className="text-lg font-bold text-stone-800">{title}</h2>
            {dateLabel && <p className="text-sm text-stone-400 mt-0.5">{dateLabel}</p>}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wide ${alignClass(col.align)}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups
                  ? groups.map(({ groupKey, rows: groupRows }) => (
                      <React.Fragment key={groupKey}>
                        {/* Group header row */}
                        <tr className="bg-stone-50 border-t border-stone-200">
                          <td
                            colSpan={visibleCols.length}
                            className="px-4 py-2 text-xs font-semibold text-stone-600 uppercase tracking-wide"
                          >
                            {groupKey}
                          </td>
                        </tr>
                        {groupRows.map((row, ri) => (
                          <tr
                            key={`${groupKey}-${ri}`}
                            className="border-b border-stone-50 hover:bg-stone-50 transition-colors"
                          >
                            {visibleCols.map((col) => (
                              <td
                                key={col.key}
                                className={`px-4 py-3 text-stone-700 whitespace-nowrap ${alignClass(col.align)}`}
                              >
                                {formatCell(row[col.key], col.format)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  : rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-stone-50 hover:bg-stone-50 transition-colors"
                      >
                        {visibleCols.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-3 text-stone-700 whitespace-nowrap ${alignClass(col.align)}`}
                          >
                            {formatCell(row[col.key], col.format)}
                          </td>
                        ))}
                      </tr>
                    ))}

                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={visibleCols.length}
                      className="px-4 py-10 text-center text-stone-400"
                    >
                      No data available.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals footer */}
              {totals && (
                <tfoot>
                  <tr className="border-t-2 border-stone-300 bg-stone-50">
                    {visibleCols.map((col, i) => {
                      const val = totals[col.key];
                      const isFirst = i === 0;
                      if (isFirst && totalsLabel) {
                        return (
                          <td
                            key={col.key}
                            className="px-4 py-3 text-sm font-bold text-stone-800 uppercase tracking-wide"
                          >
                            {totalsLabel}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 font-bold text-stone-900 ${alignClass(col.align)}`}
                        >
                          {val !== undefined && val !== null
                            ? formatCell(val, col.format)
                            : ""}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Timestamp footer */}
          <div className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">
            {timestampStr}
          </div>
        </div>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <EmailModal
          defaultSubject={title}
          onClose={() => setShowEmailModal(false)}
          onSend={handleSendEmail}
          isSending={isEmailPending}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
