"use client";

import { useState, useTransition } from "react";
import { createInvoice, updateInvoice } from "@/server/actions";
import { useRouter } from "next/navigation";

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

export function InvoiceForm({
  invoice,
  purchaseOrderId,
  onCancel,
}: {
  invoice?: Invoice;
  purchaseOrderId?: number;
  onCancel?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const effectivePOId = invoice?.purchaseOrderId ?? purchaseOrderId;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const sellOverride = formData.get("sellPriceOverride") as string;
    const buyOverride = formData.get("buyPriceOverride") as string;

    const data = {
      invoiceNumber: formData.get("invoiceNumber") as string,
      purchaseOrderId: Number(formData.get("purchaseOrderId") || effectivePOId),
      quantityTons: Number(formData.get("quantityTons")),
      sellPriceOverride: sellOverride ? Number(sellOverride) : undefined,
      buyPriceOverride: buyOverride ? Number(buyOverride) : undefined,
      shipmentDate: (formData.get("shipmentDate") as string) || undefined,
      estimatedArrival: (formData.get("estimatedArrival") as string) || undefined,
      shipmentStatus: (formData.get("shipmentStatus") as "programado" | "en_transito" | "en_aduana" | "entregado") || undefined,
      customerPaymentStatus: (formData.get("customerPaymentStatus") as "paid" | "unpaid") || undefined,
      supplierPaymentStatus: (formData.get("supplierPaymentStatus") as "paid" | "unpaid") || undefined,
      usesFactoring: formData.get("usesFactoring") === "on",
      freightCost: formData.get("freightCost") ? Number(formData.get("freightCost")) : undefined,
      item: (formData.get("item") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    startTransition(async () => {
      if (invoice) {
        await updateInvoice(invoice.id, data);
      } else {
        await createInvoice(data as Parameters<typeof createInvoice>[0]);
      }
      if (onCancel) onCancel();
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-md shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-4">
        {invoice ? "Edit Invoice" : "New Invoice"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {effectivePOId && (
          <input type="hidden" name="purchaseOrderId" value={effectivePOId} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Invoice Number *</label>
            <input
              name="invoiceNumber"
              required
              defaultValue={invoice?.invoiceNumber || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="INV-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantity (Tons) *</label>
            <input
              name="quantityTons"
              type="number"
              step="0.01"
              required
              defaultValue={invoice?.quantityTons || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Item</label>
            <input
              name="item"
              defaultValue={invoice?.item || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="White Gold 316"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sell Price Override</label>
            <input
              name="sellPriceOverride"
              type="number"
              step="0.01"
              defaultValue={invoice?.sellPriceOverride ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Leave empty to use PO price"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Buy Price Override</label>
            <input
              name="buyPriceOverride"
              type="number"
              step="0.01"
              defaultValue={invoice?.buyPriceOverride ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Leave empty to use PO price"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Freight Cost (USD)</label>
            <input
              name="freightCost"
              type="number"
              step="0.01"
              defaultValue={invoice?.freightCost ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Transport/freight cost"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shipment Date</label>
            <input
              name="shipmentDate"
              type="date"
              defaultValue={invoice?.shipmentDate || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estimated Arrival</label>
            <input
              name="estimatedArrival"
              type="date"
              defaultValue={invoice?.estimatedArrival || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shipment Status</label>
            <select
              name="shipmentStatus"
              defaultValue={invoice?.shipmentStatus || "programado"}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="programado">Scheduled</option>
              <option value="en_transito">In Transit</option>
              <option value="en_aduana">Customs</option>
              <option value="entregado">Delivered</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Customer Payment</label>
            <select
              name="customerPaymentStatus"
              defaultValue={invoice?.customerPaymentStatus || "unpaid"}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier Payment</label>
            <select
              name="supplierPaymentStatus"
              defaultValue={invoice?.supplierPaymentStatus || "unpaid"}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                name="usesFactoring"
                type="checkbox"
                defaultChecked={invoice?.usesFactoring || false}
                className="rounded border-border"
              />
              Uses Factoring
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            name="notes"
            defaultValue={invoice?.notes || ""}
            rows={2}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            placeholder="Additional notes..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : invoice ? "Update" : "Create Invoice"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
