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

export function InvoiceListActions({
  invoice,
  clientEmail,
}: {
  invoice: Invoice;
  clientEmail?: string | null;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendTo, setSendTo] = useState(clientEmail || "");
  const [sendCc, setSendCc] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    startTransition(async () => {
      await deleteInvoice(invoice.id);
      router.refresh();
    });
  }

  async function handleSend() {
    if (!sendTo) return;
    setSendLoading(true);
    const res = await fetch("/api/invoice-pdf/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber, to: sendTo, cc: sendCc || undefined }),
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
        <p className="text-[10px] text-stone-400">Invoice PDF + BOL/PL documents will be attached</p>
      </div>
    );
  }

  return (
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
          <button
            onClick={() => { setSendTo(clientEmail || ""); setShowSend(true); }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            Send
          </button>
        )
      )}
      <button
        onClick={() => setShowEdit(true)}
        className="text-xs text-primary hover:underline"
      >
        Edit
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-destructive hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
