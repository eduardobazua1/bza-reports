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

export function InvoiceListActions({ invoice }: { invoice: Invoice }) {
  const [showEdit, setShowEdit] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    startTransition(async () => {
      await deleteInvoice(invoice.id);
      router.refresh();
    });
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

  return (
    <div className="flex gap-2 justify-end">
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
