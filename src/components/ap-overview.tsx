"use client";

import React, { useState } from "react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { ChevronDown, ChevronRight, X, ExternalLink } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type SupplierInvoiceItem = {
  id: number;
  purchaseOrderId: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  estimatedTons: number | null;
  amountUsd: number | null;
  fileName: string | null;
  fileUrl: string | null;
  paymentStatus: string;
  poNumber: string | null;
  supplierName: string | null;
};

type LinkedInvoice = {
  id: number;
  paymentId: number;
  invoiceId: number | null;
  invoiceNumber: string;
  estimatedTons: number | null;
};

type SupplierPaymentItem = {
  id: number;
  supplierId: number;
  supplierName: string | null;
  purchaseOrderId: number | null;
  poNumber: string | null;
  amountUsd: number;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  estimatedTons?: number | null;
  pricePerTon?: number | null;
  actualTons?: number | null;
  actualAmount?: number | null;
  adjustmentAmount?: number | null;
  adjustmentStatus?: string | null;
  invoices: LinkedInvoice[];
};

type APOverviewProps = {
  supplierInvoices: SupplierInvoiceItem[];
  supplierPayments: SupplierPaymentItem[];
  onAddPayment: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  wire_transfer: "Wire Transfer",
  cv_credit: "CV Credit",
  xepellin: "Xepellin",
  factoraje_bbva: "Factoraje BBVA",
  biopappel_scribe: "Biopappel/Scribe",
  other: "Other",
};

function BalanceBadge({ balance }: { balance: number }) {
  if (balance > 0.01)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
        Owe
      </span>
    );
  if (balance < -0.01)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e6f1ee] text-[#0d3d3b]">
        Credit
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-500">
      Settled
    </span>
  );
}

function POStatusBadge({ balance }: { balance: number }) {
  if (balance > 0.01)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0d3d3b]/8 text-[#0d3d3b] border border-[#0d3d3b]/25">
        Pending
      </span>
    );
  if (balance < -0.01)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#e6f1ee] text-[#0d3d3b] border border-[#0d3d3b]/20">
        Credit
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-50 text-stone-500 border border-stone-200">
      Settled
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-[#e6f1ee] text-[#0d3d3b]",
    partial: "bg-[#0d3d3b]/10 text-[#0d3d3b]",
    unpaid: "bg-stone-100 text-stone-700",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
        map[status] ?? "bg-stone-100 text-stone-500"
      }`}
    >
      {status}
    </span>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

type DrawerPO = {
  poId: number;
  poNumber: string | null;
  supplierId: number;
  supplierName: string | null;
  invoiced: number;
  paid: number;
  balance: number;
  invoices: SupplierInvoiceItem[];
  payments: SupplierPaymentItem[];
};

function PODrawer({
  po,
  onClose,
}: {
  po: DrawerPO;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/purchase-orders/${po.poId}`}
                className="text-xl font-bold text-[#0d3d3b] hover:underline flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {po.poNumber || `PO #${po.poId}`}
                <ExternalLink className="w-3.5 h-3.5 opacity-50" />
              </Link>
              <BalanceBadge balance={po.balance} />
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              <Link
                href={`/suppliers/${po.supplierId}`}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {po.supplierName?.split("(")[0].trim() || "Unknown Supplier"}
              </Link>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* A/P summary strip */}
        <div className="px-5 py-3 border-b border-stone-100 flex gap-3 flex-shrink-0">
          <div className="flex-1 bg-stone-50 rounded-md px-3 py-2 text-center">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Invoiced</p>
            <p className="text-sm font-bold text-stone-800">{formatCurrency(po.invoiced)}</p>
          </div>
          <div className="flex-1 bg-[#e6f1ee] rounded-md px-3 py-2 text-center">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Paid</p>
            <p className="text-sm font-bold text-[#0d3d3b]">{formatCurrency(po.paid)}</p>
          </div>
          <div
            className={`flex-1 rounded-md px-3 py-2 text-center ${
              po.balance > 0.01
                ? "bg-stone-50"
                : po.balance < -0.01
                ? "bg-[#e6f1ee]"
                : "bg-stone-50"
            }`}
          >
            <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Balance</p>
            <p
              className={`text-sm font-bold ${
                po.balance > 0.01
                  ? "text-stone-600"
                  : po.balance < -0.01
                  ? "text-[#0d3d3b]"
                  : "text-stone-500"
              }`}
            >
              {formatCurrency(Math.abs(po.balance))}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Supplier Invoices */}
          <div className="px-5 pt-4 pb-2">
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
              Supplier Invoices
            </h4>
          </div>
          {po.invoices.length === 0 ? (
            <p className="px-5 pb-4 text-xs text-stone-400 italic">No supplier invoices linked to this PO.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium text-stone-500">Invoice #</th>
                    <th className="text-left px-3 py-2 font-medium text-stone-500">Date</th>
                    <th className="text-right px-3 py-2 font-medium text-stone-500">Tons</th>
                    <th className="text-right px-3 py-2 font-medium text-stone-500">Amount</th>
                    <th className="text-center px-3 py-2 font-medium text-stone-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {po.invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-stone-100">
                      <td className="px-5 py-2 font-medium text-[#0d3d3b]">
                        {inv.fileUrl ? (
                          <a
                            href={inv.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {inv.invoiceNumber}
                            <ExternalLink className="w-2.5 h-2.5 opacity-40" />
                          </a>
                        ) : (
                          inv.invoiceNumber
                        )}
                      </td>
                      <td className="px-3 py-2 text-stone-600 whitespace-nowrap">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="px-3 py-2 text-right text-stone-700">
                        {inv.estimatedTons != null ? formatNumber(inv.estimatedTons, 3) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-stone-800">
                        {inv.amountUsd != null ? formatCurrency(inv.amountUsd) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <InvoiceStatusBadge status={inv.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 border-t-2 border-stone-200 font-semibold">
                    <td className="px-5 py-2" colSpan={3}>Total</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(po.invoices.reduce((s, i) => s + (i.amountUsd ?? 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Payments Applied */}
          <div className="px-5 pt-5 pb-2">
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
              Payments Applied
            </h4>
          </div>
          {po.payments.length === 0 ? (
            <p className="px-5 pb-6 text-xs text-stone-400 italic">No payments applied to this PO.</p>
          ) : (
            <div className="overflow-x-auto pb-6">
              <table className="w-full text-xs">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium text-stone-500">Date</th>
                    <th className="text-right px-3 py-2 font-medium text-stone-500">Amount</th>
                    <th className="text-left px-3 py-2 font-medium text-stone-500">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {po.payments.map((pmt) => (
                    <tr key={pmt.id} className="border-t border-stone-100">
                      <td className="px-5 py-2 text-stone-600 whitespace-nowrap">
                        {formatDate(pmt.paymentDate)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#0d3d3b]">
                        {formatCurrency(pmt.amountUsd)}
                      </td>
                      <td className="px-3 py-2 text-stone-600">
                        {pmt.reference || pmt.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 border-t-2 border-stone-200 font-semibold">
                    <td className="px-5 py-2">Total</td>
                    <td className="px-3 py-2 text-right text-[#0d3d3b]">
                      {formatCurrency(po.payments.reduce((s, p) => s + p.amountUsd, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function APOverview({
  supplierInvoices,
  supplierPayments,
  onAddPayment,
}: APOverviewProps) {
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<number>>(new Set());
  const [drawerPO, setDrawerPO] = useState<DrawerPO | null>(null);

  // ── Per-supplier aggregates ───────────────────────────────────────────────

  // Unique suppliers from invoices
  const supplierIds = [...new Set(supplierInvoices.map((i) => i.supplierId))];
  // Only count payments from suppliers that have formal invoices (avoids inflating totals with unlinked/legacy payments)
  const knownSupplierIdSet = new Set(supplierIds);

  // ── Aggregate totals (derived from known suppliers only) ──────────────────

  const totalInvoiced = supplierInvoices.reduce((s, i) => s + (i.amountUsd ?? 0), 0);
  const totalPaid = supplierPayments
    .filter((p) => knownSupplierIdSet.has(p.supplierId))
    .reduce((s, p) => s + p.amountUsd, 0);
  const totalBalance = totalInvoiced - totalPaid;
  const progressPct = totalInvoiced > 0 ? Math.min(100, (totalPaid / totalInvoiced) * 100) : 0;

  type SupplierGroup = {
    supplierId: number;
    supplierName: string | null;
    invoiced: number;
    paid: number;
    balance: number;
    // POs
    pos: POGroup[];
  };

  type POGroup = {
    poId: number;
    poNumber: string | null;
    invoiced: number;
    paid: number;
    balance: number;
    invoices: SupplierInvoiceItem[];
    payments: SupplierPaymentItem[];
  };

  const supplierGroups: SupplierGroup[] = supplierIds.map((sid) => {
    const sInvoices = supplierInvoices.filter((i) => i.supplierId === sid);
    const sPayments = supplierPayments.filter((p) => p.supplierId === sid);
    const sName = sInvoices[0]?.supplierName ?? sPayments[0]?.supplierName ?? null;

    const sInvoiced = sInvoices.reduce((s, i) => s + (i.amountUsd ?? 0), 0);
    const sPaid = sPayments.reduce((s, p) => s + p.amountUsd, 0);
    const sBalance = sInvoiced - sPaid;

    // Group by PO
    const poIds = [...new Set(sInvoices.map((i) => i.purchaseOrderId))];
    const pos: POGroup[] = poIds.map((poId) => {
      const pInvoices = sInvoices.filter((i) => i.purchaseOrderId === poId);
      const pPayments = sPayments.filter((p) => p.purchaseOrderId === poId);
      const pInvoiced = pInvoices.reduce((s, i) => s + (i.amountUsd ?? 0), 0);
      const pPaid = pPayments.reduce((s, p) => s + p.amountUsd, 0);
      return {
        poId,
        poNumber: pInvoices[0]?.poNumber ?? null,
        invoiced: pInvoiced,
        paid: pPaid,
        balance: pInvoiced - pPaid,
        invoices: pInvoices,
        payments: pPayments,
      };
    });

    return {
      supplierId: sid,
      supplierName: sName,
      invoiced: sInvoiced,
      paid: sPaid,
      balance: sBalance,
      pos,
    };
  });

  // KPI chips
  const suppliersWithBalance = supplierGroups.filter((s) => s.balance > 0.01).length;
  const suppliersFullySettled = supplierGroups.filter((s) => Math.abs(s.balance) <= 0.01).length;

  function toggleSupplier(id: number) {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openDrawer(group: SupplierGroup, po: POGroup) {
    setDrawerPO({
      poId: po.poId,
      poNumber: po.poNumber,
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      invoiced: po.invoiced,
      paid: po.paid,
      balance: po.balance,
      invoices: po.invoices,
      payments: po.payments,
    });
  }

  // Payment history row expand state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  function toggleRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSupplierPaid = supplierPayments.reduce((s, p) => s + p.amountUsd, 0);

  return (
    <div className="space-y-6">
      {/* ── Level 1: Hero banner ─────────────────────────────────────────────── */}
      <div className={`bg-white rounded-lg shadow-sm border-l-[5px] overflow-hidden ${totalBalance > 0.01 ? "border-l-stone-500" : "border-l-[#0d3d3b]"}`}>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: title + balance */}
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest font-medium mb-1">
                Accounts Payable
              </p>
              <p className={`text-4xl font-bold tracking-tight ${totalBalance > 0.01 ? "text-stone-600" : "text-[#0d3d3b]"}`}>
                {Math.abs(totalBalance) < 0.01 ? "—" : formatCurrency(Math.abs(totalBalance))}
              </p>
              <p className="text-sm text-stone-500 mt-1.5">
                {totalBalance > 0.01
                  ? "Outstanding balance you owe"
                  : totalBalance < -0.01
                  ? "Credit in your favor"
                  : "✓ Fully settled"}
              </p>
            </div>

            {/* Right: badge + totals */}
            <div className="text-right">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${totalBalance > 0.01 ? "bg-stone-100 text-stone-700" : "bg-[#0d3d3b]/10 text-[#0d3d3b]"}`}>
                {totalBalance > 0.01 ? "⚠ Pending" : totalBalance < -0.01 ? "↑ Credit" : "✓ Settled"}
              </span>
              <div className="mt-2 space-y-0.5 text-xs text-stone-400">
                <div className="flex items-center justify-end gap-2">
                  <span>Total Invoiced:</span>
                  <span className="font-semibold text-stone-600">{formatCurrency(totalInvoiced)}</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span>Total Paid:</span>
                  <span className="font-semibold text-stone-600">{formatCurrency(totalPaid)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-stone-400 mb-1.5">
              <span>{formatCurrency(totalPaid)} paid of {formatCurrency(totalInvoiced)} invoiced</span>
              <span className="font-medium">{progressPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-[#0d3d3b]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Level 2: KPI chips ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Invoiced",
            value: formatCurrency(totalInvoiced),
            sub: `${supplierInvoices.length} invoice${supplierInvoices.length !== 1 ? "s" : ""}`,
            accent: "border-l-[#0d3d3b]",
          },
          {
            label: "Total Paid",
            value: formatCurrency(totalPaid),
            sub: `${supplierPayments.filter(p => knownSupplierIdSet.has(p.supplierId)).length} payment${supplierPayments.filter(p => knownSupplierIdSet.has(p.supplierId)).length !== 1 ? "s" : ""}`,
            accent: "border-l-[#0d3d3b]",
          },
          {
            label: "Suppliers with Balance",
            value: String(suppliersWithBalance),
            sub: "outstanding balance",
            accent: "border-l-[#0d3d3b]",
          },
          {
            label: "Fully Settled",
            value: String(suppliersFullySettled),
            sub: `of ${supplierGroups.length} supplier${supplierGroups.length !== 1 ? "s" : ""}`,
            accent: "border-l-[#0d3d3b]",
          },
        ].map((chip) => (
          <div
            key={chip.label}
            className={`bg-white rounded-md shadow-sm border-l-[3px] ${chip.accent} p-4 space-y-1`}
          >
            <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">{chip.label}</p>
            <p className="text-xl font-bold text-stone-800">{chip.value}</p>
            {chip.sub && <p className="text-xs text-stone-400">{chip.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Level 3: Per-supplier expandable cards ───────────────────────────── */}
      <div className="space-y-3">
        {supplierGroups.length === 0 && (
          <div className="bg-white rounded-lg border border-stone-100 shadow-sm p-8 text-center text-sm text-stone-400">
            No supplier invoices found.
          </div>
        )}
        {supplierGroups.map((group) => {
          const isExpanded = expandedSuppliers.has(group.supplierId);
          const balColor =
            group.balance > 0.01
              ? "text-stone-600"
              : group.balance < -0.01
              ? "text-[#0d3d3b]"
              : "text-stone-500";

          return (
            <div
              key={group.supplierId}
              className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <button
                type="button"
                onClick={() => toggleSupplier(group.supplierId)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
              >
                {/* Chevron */}
                <span className="text-stone-400 flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>

                {/* Supplier name */}
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm text-[#0d3d3b]">
                    <Link
                      href={`/suppliers/${group.supplierId}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.supplierName?.split("(")[0].trim() || `Supplier #${group.supplierId}`}
                    </Link>
                  </span>
                </span>

                {/* Invoiced */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wide">Invoiced</span>
                  <span className="text-xs font-semibold text-stone-700">{formatCurrency(group.invoiced)}</span>
                </div>

                {/* Paid */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wide">Paid</span>
                  <span className="text-xs font-semibold text-[#0d3d3b]">{formatCurrency(group.paid)}</span>
                </div>

                {/* Balance */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-stone-400 uppercase tracking-wide">Balance</span>
                  <span className={`text-xs font-bold ${balColor}`}>
                    {formatCurrency(Math.abs(group.balance))}
                  </span>
                </div>

                {/* Badge */}
                <span className="flex-shrink-0">
                  <BalanceBadge balance={group.balance} />
                </span>
              </button>

              {/* Expanded PO table */}
              {isExpanded && (
                <div className="border-t border-stone-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-stone-400 uppercase tracking-wide">PO #</th>
                        <th className="text-right px-4 py-2 font-medium text-stone-400 uppercase tracking-wide">Invoiced</th>
                        <th className="text-right px-4 py-2 font-medium text-stone-400 uppercase tracking-wide">Paid</th>
                        <th className="text-right px-4 py-2 font-medium text-stone-400 uppercase tracking-wide">Balance</th>
                        <th className="text-center px-4 py-2 font-medium text-stone-400 uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.pos.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-center text-stone-400">
                            No POs found for this supplier.
                          </td>
                        </tr>
                      )}
                      {group.pos.map((po) => {
                        const poBalColor =
                          po.balance > 0.01
                            ? "text-stone-600"
                            : po.balance < -0.01
                            ? "text-[#0d3d3b]"
                            : "text-stone-500";
                        return (
                          <tr
                            key={po.poId}
                            onClick={() => openDrawer(group, po)}
                            className="border-t border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-[#0d3d3b]">
                              {po.poNumber || `PO #${po.poId}`}
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-700">
                              {formatCurrency(po.invoiced)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#0d3d3b]">
                              {formatCurrency(po.paid)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${poBalColor}`}>
                              {formatCurrency(Math.abs(po.balance))}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <POStatusBadge balance={po.balance} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {group.pos.length > 1 && (
                      <tfoot>
                        <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                          <td className="px-4 py-2 text-xs text-stone-500">TOTAL</td>
                          <td className="px-4 py-2 text-right text-xs text-stone-700">{formatCurrency(group.invoiced)}</td>
                          <td className="px-4 py-2 text-right text-xs text-[#0d3d3b]">{formatCurrency(group.paid)}</td>
                          <td className={`px-4 py-2 text-right text-xs font-bold ${balColor}`}>
                            {formatCurrency(Math.abs(group.balance))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Level 5: Payment History ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Payment History</h2>
        <button
          onClick={onAddPayment}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          + Add Payment
        </button>
      </div>

      <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-stone-50">
              <tr className="text-left">
                <th className="p-3 w-8"></th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Date</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Supplier</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">PO</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-center">Invoices</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Est. TN</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Act. TN</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">$/TN</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Amount Paid</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Method</th>
                <th className="p-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Reference</th>
              </tr>
            </thead>
            <tbody>
              {supplierPayments.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-stone-400">
                    No supplier payments recorded. Click &quot;+ Add Payment&quot; to start tracking.
                  </td>
                </tr>
              )}
              {supplierPayments.map((p) => {
                const isExpanded = expandedRows.has(p.id);
                const derivedPpt =
                  p.pricePerTon ||
                  (p.estimatedTons && p.estimatedTons > 0 ? p.amountUsd / p.estimatedTons : null);

                return (
                  <React.Fragment key={p.id}>
                    <tr className="border-t border-stone-100 hover:bg-stone-50 transition-colors">
                      <td className="p-3">
                        {p.invoices.length > 0 && (
                          <button
                            onClick={() => toggleRow(p.id)}
                            className="text-stone-400 hover:text-stone-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-xs text-[#0d3d3b]">{formatDate(p.paymentDate)}</td>
                      <td className="p-3 text-xs text-[#0d3d3b]">
                        {p.supplierName?.split("(")[0].trim() || "—"}
                      </td>
                      <td className="p-3 text-xs text-[#0d3d3b]">
                        {p.purchaseOrderId ? (
                          <Link href={`/purchase-orders/${p.purchaseOrderId}`} className="hover:underline">
                            {p.poNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-xs text-center text-[#0d3d3b]">
                        {p.invoices.length > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0d3d3b]/10 text-[10px] font-semibold text-[#0d3d3b]">
                            {p.invoices.length}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-xs text-right text-[#0d3d3b]">
                        {p.estimatedTons != null ? formatNumber(p.estimatedTons, 3) : "—"}
                      </td>
                      <td
                        className={`p-3 text-xs text-right ${
                          p.actualTons != null ? "text-[#0d3d3b] font-medium" : "text-stone-300"
                        }`}
                      >
                        {p.actualTons != null ? formatNumber(p.actualTons, 3) : "—"}
                      </td>
                      <td className="p-3 text-xs text-right text-[#0d3d3b]">
                        {derivedPpt ? formatCurrency(derivedPpt) : "—"}
                      </td>
                      <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">
                        {formatCurrency(p.amountUsd)}
                      </td>
                      <td className="p-3 text-xs text-stone-500">
                        {p.paymentMethod ? (METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod) : "—"}
                      </td>
                      <td className="p-3 text-xs text-stone-500">{p.reference || p.notes || "—"}</td>
                    </tr>
                    {isExpanded && p.invoices.length > 0 && (
                      <tr key={`${p.id}-exp`} className="bg-stone-50 border-t border-stone-100">
                        <td colSpan={11} className="px-8 py-3">
                          <p className="text-[10px] uppercase font-semibold tracking-widest text-stone-400 mb-2">
                            Invoices covered by this payment
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {p.invoices.map((inv) => (
                              <div
                                key={inv.id}
                                className="flex items-center gap-1.5 bg-white border border-stone-200 rounded px-2 py-1"
                              >
                                <span className="text-xs font-medium text-[#0d3d3b]">{inv.invoiceNumber}</span>
                                {inv.estimatedTons && (
                                  <span className="text-[10px] text-stone-400">
                                    {formatNumber(inv.estimatedTons, 3)} TN
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {supplierPayments.length > 0 && (
              <tfoot>
                <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200">
                  <td className="p-3 text-xs text-[#0d3d3b]" colSpan={8}>
                    TOTAL
                  </td>
                  <td className="p-3 text-xs text-right font-semibold text-[#0d3d3b]">
                    {formatCurrency(totalSupplierPaid)}
                  </td>
                  <td colSpan={2} className="p-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Level 4: Drawer ──────────────────────────────────────────────────── */}
      {drawerPO && (
        <PODrawer po={drawerPO} onClose={() => setDrawerPO(null)} />
      )}
    </div>
  );
}
