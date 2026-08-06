"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

type SupplierInvoiceItem = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  estimatedTons: number;
  amountUsd: number;
  paymentStatus: string | null;
  fileName: string | null;
  linkedInvoiceId: number | null;
  linkedInvoiceNumber?: string | null;
};

type PaymentItem = {
  id: number;
  paymentDate: string | null;
  amountUsd: number;
  reference: string | null;
  notes: string | null;
};

type APRow = {
  po: { id: number; poNumber: string; poDate: string | null };
  invoiced: number;
  paid: number;
  balance: number;
};

type Props = {
  apRows: APRow[];
  invoicesByPo: Record<number, SupplierInvoiceItem[]>;
  paymentsByPo: Record<number, PaymentItem[]>;
  supplierName: string;
};

function StatusBadge({ balance }: { balance: number }) {
  if (balance > 0)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0d3d3b]/10 text-[#0d3d3b]">
        Pending
      </span>
    );
  if (balance < 0)
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

export function APDetailDrawer({ apRows, invoicesByPo, paymentsByPo, supplierName }: Props) {
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);

  const apTotalInvoiced = apRows.reduce((s, r) => s + r.invoiced, 0);
  const apTotalPaid = apRows.reduce((s, r) => s + r.paid, 0);
  const apTotalBalance = apTotalInvoiced - apTotalPaid;

  const selectedRow = selectedPoId !== null ? apRows.find((r) => r.po.id === selectedPoId) ?? null : null;
  const drawerInvoices: SupplierInvoiceItem[] = selectedPoId !== null ? (invoicesByPo[selectedPoId] ?? []) : [];
  const drawerPayments: PaymentItem[] = selectedPoId !== null ? (paymentsByPo[selectedPoId] ?? []) : [];

  const drawerInvoiceTotal = drawerInvoices.reduce((s, i) => s + (i.amountUsd ?? 0), 0);
  const drawerPaymentTotal = drawerPayments.reduce((s, p) => s + (p.amountUsd ?? 0), 0);

  function close() {
    setSelectedPoId(null);
  }

  return (
    <>
      {/* A/P Balance by PO table */}
      <div className="bg-white rounded-md shadow-sm border-l-[3px] border-l-[#0d3d3b]">
        <div className="px-4 py-3 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">A/P Balance by PO</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Supplier invoices vs. payments per purchase order — click a row for details
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-500">PO #</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Invoiced</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Paid</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-500">Balance</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {apRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-stone-400">
                    No supplier invoices on record.
                  </td>
                </tr>
              )}
              {apRows.map((r) => {
                const balAmt = r.balance;
                const balColor =
                  balAmt > 0 ? "text-stone-600" : balAmt < 0 ? "text-[#0d3d3b]" : "text-stone-400";
                const isSelected = selectedPoId === r.po.id;
                return (
                  <tr
                    key={r.po.id}
                    onClick={() => setSelectedPoId(r.po.id)}
                    className={`border-t border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors ${
                      isSelected ? "bg-stone-50 ring-1 ring-inset ring-[#0d3d3b]/20" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-xs font-medium">
                      <span className="text-[#0d3d3b]">{r.po.poNumber}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-stone-700">
                      {formatCurrency(r.invoiced)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-stone-700">
                      {formatCurrency(r.paid)}
                    </td>
                    <td className={`px-4 py-2.5 text-xs text-right font-semibold ${balColor}`}>
                      {balAmt !== 0 ? (balAmt < 0 ? "−" : "") : ""}
                      {formatCurrency(Math.abs(balAmt))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge balance={balAmt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {apRows.length > 0 && (
              <tfoot>
                <tr className="bg-stone-50 font-semibold border-t-2 border-stone-200 text-xs">
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(apTotalInvoiced)}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(apTotalPaid)}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      apTotalBalance > 0
                        ? "text-stone-600"
                        : apTotalBalance < 0
                        ? "text-[#0d3d3b]"
                        : "text-stone-400"
                    }`}
                  >
                    {apTotalBalance !== 0 ? (apTotalBalance < 0 ? "−" : "") : ""}
                    {formatCurrency(Math.abs(apTotalBalance))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Drawer */}
      {selectedRow !== null && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={close}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[480px] z-50 bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/purchase-orders/${selectedRow.po.id}`}
                    className="text-xl font-bold text-[#0d3d3b] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedRow.po.poNumber}
                  </a>
                  <StatusBadge balance={selectedRow.balance} />
                </div>
                {selectedRow.po.poDate && (
                  <p className="text-xs text-stone-400 mt-0.5">{formatDate(selectedRow.po.poDate)}</p>
                )}
                <p className="text-xs text-stone-400 mt-0.5">{supplierName}</p>
              </div>
              <button
                onClick={close}
                className="text-stone-400 hover:text-stone-700 transition-colors text-lg leading-none mt-0.5 flex-shrink-0"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* A/P summary strip */}
            <div className="px-5 py-3 border-b border-stone-100 flex gap-3">
              <div className="flex-1 bg-stone-50 rounded-md px-3 py-2 text-center">
                <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Invoiced</p>
                <p className="text-sm font-bold text-stone-800">{formatCurrency(selectedRow.invoiced)}</p>
              </div>
              <div className="flex-1 bg-[#e6f1ee] rounded-md px-3 py-2 text-center">
                <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Paid</p>
                <p className="text-sm font-bold text-[#0d3d3b]">{formatCurrency(selectedRow.paid)}</p>
              </div>
              <div
                className={`flex-1 rounded-md px-3 py-2 text-center ${
                  selectedRow.balance > 0
                    ? "bg-stone-50"
                    : selectedRow.balance < 0
                    ? "bg-[#e6f1ee]"
                    : "bg-stone-50"
                }`}
              >
                <p className="text-[10px] text-stone-400 uppercase tracking-wide mb-0.5">Balance</p>
                <p
                  className={`text-sm font-bold ${
                    selectedRow.balance > 0
                      ? "text-stone-600"
                      : selectedRow.balance < 0
                      ? "text-[#0d3d3b]"
                      : "text-stone-400"
                  }`}
                >
                  {selectedRow.balance !== 0 ? (selectedRow.balance < 0 ? "−" : "") : ""}
                  {formatCurrency(Math.abs(selectedRow.balance))}
                </p>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Supplier Invoices section */}
              <div className="px-5 pt-4 pb-2">
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-widest mb-2">
                  Supplier Invoices
                </h4>
              </div>
              {drawerInvoices.length === 0 ? (
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
                      {drawerInvoices.map((inv) => {
                        const statusColor =
                          inv.paymentStatus === "paid"
                            ? "bg-[#e6f1ee] text-[#0d3d3b]"
                            : inv.paymentStatus === "partial"
                            ? "bg-[#0d3d3b]/10 text-[#0d3d3b]"
                            : "bg-stone-100 text-stone-700";
                        return (
                          <tr key={inv.id} className="border-t border-stone-100">
                            <td className="px-5 py-2 font-medium text-[#0d3d3b]">
                              <span className="flex items-center gap-1">
                                {inv.invoiceNumber}
                                {inv.fileName && (
                                  <span title={inv.fileName} className="text-stone-400 cursor-default">
                                    📄
                                  </span>
                                )}
                              </span>
                              {inv.linkedInvoiceNumber && (
                                <span className="text-[10px] text-stone-400 block">
                                  → {inv.linkedInvoiceNumber}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-stone-600 whitespace-nowrap">
                              {formatDate(inv.invoiceDate)}
                            </td>
                            <td className="px-3 py-2 text-right text-stone-700">
                              {inv.estimatedTons != null ? inv.estimatedTons.toLocaleString() : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-stone-800">
                              {formatCurrency(inv.amountUsd ?? 0)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColor}`}
                              >
                                {inv.paymentStatus ?? "unpaid"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-stone-50 border-t-2 border-stone-200 font-semibold">
                        <td className="px-5 py-2" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(drawerInvoiceTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Payments Applied section */}
              <div className="px-5 pt-5 pb-2">
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-widest mb-2">
                  Payments Applied
                </h4>
              </div>
              {drawerPayments.length === 0 ? (
                <p className="px-5 pb-4 text-xs text-stone-400 italic">No payments applied to this PO.</p>
              ) : (
                <div className="overflow-x-auto pb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="text-left px-5 py-2 font-medium text-stone-500">Date</th>
                        <th className="text-right px-3 py-2 font-medium text-stone-500">Amount</th>
                        <th className="text-left px-3 py-2 font-medium text-stone-500">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawerPayments.map((pmt) => (
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
                          {formatCurrency(drawerPaymentTotal)}
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
      )}
    </>
  );
}
