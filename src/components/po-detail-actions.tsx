"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { POForm } from "@/components/po-form";
import { InvoiceForm } from "@/components/invoice-form";
import { deletePurchaseOrder } from "@/server/actions";

type Client = {
  id: number;
  name: string;
  fscLicense?: string | null;
  fscChainOfCustody?: string | null;
  fscInputClaim?: string | null;
  fscOutputClaim?: string | null;
  pefc?: string | null;
};
type Supplier = {
  id: number;
  name: string;
  certType?: string | null;
  fscLicense?: string | null;
  fscChainOfCustody?: string | null;
  fscInputClaim?: string | null;
  fscOutputClaim?: string | null;
  pefc?: string | null;
};
type Product = { id: number; name: string; grade?: string | null };

type PurchaseOrder = {
  id: number;
  poNumber: string;
  poDate: string | null;
  clientId: number;
  clientPoNumber: string | null;
  supplierId: number;
  sellPrice: number;
  buyPrice: number;
  product: string;
  supplierProductId?: number | null;
  clientProductId?: number | null;
  terms: string | null;
  transportType: "ffcc" | "ship" | "truck" | null;
  licenseFsc: string | null;
  chainOfCustody: string | null;
  inputClaim: string | null;
  outputClaim: string | null;
  status: "active" | "completed" | "cancelled";
  notes: string | null;
};

export function PODetailActions({
  purchaseOrder,
  clients,
  suppliers,
  products,
}: {
  purchaseOrder: PurchaseOrder;
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
}) {
  const [showEditPO, setShowEditPO] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Delete Purchase Order ${purchaseOrder.poNumber} and all its invoices? This cannot be undone.`)) return;
    startDelete(async () => {
      await deletePurchaseOrder(purchaseOrder.id);
      router.push("/purchase-orders");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {!showEditPO && (
          <button
            onClick={() => { setShowEditPO(true); setShowAddInvoice(false); }}
            className="border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit Purchase Order
          </button>
        )}
        {!showAddInvoice && (
          <button
            onClick={() => { setShowAddInvoice(true); setShowEditPO(false); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add Invoice
          </button>
        )}
        {!showEditPO && !showAddInvoice && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>

      {showEditPO && (
        <POForm
          purchaseOrder={purchaseOrder}
          clients={clients}
          suppliers={suppliers}
          products={products}
          onCancel={() => setShowEditPO(false)}
        />
      )}

      {showAddInvoice && (
        <InvoiceForm
          purchaseOrderId={purchaseOrder.id}
          onCancel={() => setShowAddInvoice(false)}
        />
      )}
    </div>
  );
}
