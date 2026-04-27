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
  invoiceDate: string | null;
  estimatedArrival: string | null;
  dueDate: string | null;
  paymentTermsDays: number | null;
  shipmentStatus: "programado" | "en_transito" | "en_aduana" | "entregado";
  customerPaymentStatus: "paid" | "unpaid";
  supplierPaymentStatus: "paid" | "unpaid";
  usesFactoring: boolean;
  freightCost: number | null;
  item: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  currentLocation: string | null;
  destination: string | null;
  balesCount: number | null;
  unitsPerBale: number | null;
  salesDocument: string | null;
  billingDocument: string | null;
  notes: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background";

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
    const f = new FormData(e.currentTarget);
    const n = (k: string) => f.get(k) as string || undefined;
    const num = (k: string) => f.get(k) ? Number(f.get(k)) : undefined;

    const rawInvoiceNumber = (f.get("invoiceNumber") as string).trim();
    const clientPO = (f.get("salesDocument") as string).trim();
    // Auto-generate temp invoice number if not provided yet
    const invoiceNumber = rawInvoiceNumber || `PEND-${clientPO}-${Date.now().toString().slice(-5)}`;

    const data = {
      invoiceNumber,
      purchaseOrderId: Number(f.get("purchaseOrderId") || effectivePOId),
      quantityTons: Number(f.get("quantityTons")),
      sellPriceOverride: num("sellPriceOverride"),
      buyPriceOverride: num("buyPriceOverride"),
      freightCost: num("freightCost"),
      shipmentDate: n("shipmentDate"),
      invoiceDate: n("invoiceDate"),
      estimatedArrival: n("estimatedArrival"),
      dueDate: n("dueDate"),
      paymentTermsDays: num("paymentTermsDays"),
      shipmentStatus: (n("shipmentStatus") as "programado" | "en_transito" | "en_aduana" | "entregado") || undefined,
      customerPaymentStatus: (n("customerPaymentStatus") as "paid" | "unpaid") || undefined,
      supplierPaymentStatus: (n("supplierPaymentStatus") as "paid" | "unpaid") || undefined,
      usesFactoring: f.get("usesFactoring") === "on",
      item: n("item"),
      vehicleId: n("vehicleId"),
      blNumber: n("blNumber"),
      currentLocation: n("currentLocation"),
      destination: n("destination"),
      balesCount: num("balesCount"),
      unitsPerBale: num("unitsPerBale"),
      salesDocument: n("salesDocument"),
      billingDocument: n("billingDocument"),
      notes: n("notes"),
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
      <h3 className="text-lg font-semibold mb-4">{invoice ? "Edit Invoice" : "New Invoice"}</h3>
      <form onSubmit={handleSubmit} className="space-y-5">
        {effectivePOId && <input type="hidden" name="purchaseOrderId" value={effectivePOId} />}

        {/* Section: Identification */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Identification</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Client PO # *">
              <input name="salesDocument" required defaultValue={invoice?.salesDocument || ""} className={inputCls} placeholder="X189014" />
            </Field>
            <Field label="Invoice # (leave empty until documents arrive)">
              <input name="invoiceNumber" defaultValue={invoice?.invoiceNumber || ""} className={inputCls} placeholder="IX0042-9 — from supplier BOL" />
            </Field>
            <Field label="Billing Document">
              <input name="billingDocument" defaultValue={invoice?.billingDocument || ""} className={inputCls} placeholder="BZA billing ref" />
            </Field>
          </div>
        </div>

        {/* Section: Product */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Product</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Item / Product Description">
              <input name="item" defaultValue={invoice?.item || ""} className={inputCls} placeholder="Woodpulp - Softwood" />
            </Field>
            <Field label="Quantity (ADMT) *">
              <input name="quantityTons" type="number" step="0.001" required defaultValue={invoice?.quantityTons || ""} className={inputCls} placeholder="92.101" />
            </Field>
            <Field label="Destination">
              <input name="destination" defaultValue={invoice?.destination || ""} className={inputCls} placeholder="Ecatepec" />
            </Field>
          </div>
        </div>

        {/* Section: BOL / Tracking */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Bill of Lading / Tracking</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Vehicle / Railcar #">
              <input name="vehicleId" defaultValue={invoice?.vehicleId || ""} className={inputCls} placeholder="TBOX640169" />
            </Field>
            <Field label="BOL #">
              <input name="blNumber" defaultValue={invoice?.blNumber || ""} className={inputCls} placeholder="4001058" />
            </Field>
            <Field label="Bales">
              <input name="balesCount" type="number" defaultValue={invoice?.balesCount ?? ""} className={inputCls} placeholder="378" />
            </Field>
            <Field label="Unit">
              <input name="unitsPerBale" type="number" defaultValue={invoice?.unitsPerBale ?? ""} className={inputCls} placeholder="63" />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Current Location (tracking)">
              <input name="currentLocation" defaultValue={invoice?.currentLocation || ""} className={inputCls} placeholder="Eagle Pass, TX" />
            </Field>
          </div>
        </div>

        {/* Section: Dates */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Dates</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Ship Date">
              <input name="shipmentDate" type="date" defaultValue={invoice?.shipmentDate || ""} className={inputCls} />
            </Field>
            <Field label="Invoice Date">
              <input name="invoiceDate" type="date" defaultValue={invoice?.invoiceDate || ""} className={inputCls} />
            </Field>
            <Field label="ETA">
              <input name="estimatedArrival" type="date" defaultValue={invoice?.estimatedArrival || ""} className={inputCls} />
            </Field>
            <Field label="Due Date">
              <input name="dueDate" type="date" defaultValue={invoice?.dueDate || ""} className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Section: Pricing */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Pricing (leave empty to use PO price)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Sell Price Override (USD/TN)">
              <input name="sellPriceOverride" type="number" step="0.01" defaultValue={invoice?.sellPriceOverride ?? ""} className={inputCls} placeholder="Use PO price" />
            </Field>
            <Field label="Buy Price Override (USD/TN)">
              <input name="buyPriceOverride" type="number" step="0.01" defaultValue={invoice?.buyPriceOverride ?? ""} className={inputCls} placeholder="Use PO price" />
            </Field>
            <Field label="Freight Cost (USD)">
              <input name="freightCost" type="number" step="0.01" defaultValue={invoice?.freightCost ?? ""} className={inputCls} placeholder="0.00" />
            </Field>
          </div>
        </div>

        {/* Section: Status */}
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Shipment Status">
              <select name="shipmentStatus" defaultValue={invoice?.shipmentStatus || "programado"} className={inputCls}>
                <option value="programado">Scheduled</option>
                <option value="en_transito">In Transit</option>
                <option value="en_aduana">Customs</option>
                <option value="entregado">Delivered</option>
              </select>
            </Field>
            <Field label="Customer Payment">
              <select name="customerPaymentStatus" defaultValue={invoice?.customerPaymentStatus || "unpaid"} className={inputCls}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
            <Field label="Supplier Payment">
              <select name="supplierPaymentStatus" defaultValue={invoice?.supplierPaymentStatus || "unpaid"} className={inputCls}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input name="usesFactoring" type="checkbox" id="usesFactoring" defaultChecked={invoice?.usesFactoring || false} className="rounded border-border" />
            <label htmlFor="usesFactoring" className="text-sm">Uses Factoring</label>
          </div>
        </div>

        <Field label="Notes">
          <textarea name="notes" defaultValue={invoice?.notes || ""} rows={2} className={inputCls} placeholder="Additional notes..." />
        </Field>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {isPending ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
