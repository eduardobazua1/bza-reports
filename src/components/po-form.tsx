"use client";

import { useState, useTransition } from "react";
import { createPurchaseOrder, updatePurchaseOrder } from "@/server/actions";
import { useRouter } from "next/navigation";

type Client = {
  id: number;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
  fscLicense?: string | null;
  fscChainOfCustody?: string | null;
  fscInputClaim?: string | null;
  fscOutputClaim?: string | null;
};

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
  terms: string | null;
  transportType: "ffcc" | "ship" | "truck" | null;
  licenseFsc: string | null;
  chainOfCustody: string | null;
  inputClaim: string | null;
  outputClaim: string | null;
  status: "active" | "completed" | "cancelled";
  notes: string | null;
};

// Button to trigger inline form on the list page
export function POListActions({
  clients,
  suppliers,
}: {
  clients: Client[];
  suppliers: Supplier[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New PO
        </button>
      )}
      {showForm && (
        <POForm
          clients={clients}
          suppliers={suppliers}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// Full PO form for create and edit
export function POForm({
  purchaseOrder,
  clients,
  suppliers,
  onCancel,
}: {
  purchaseOrder?: PurchaseOrder;
  clients: Client[];
  suppliers: Supplier[];
  onCancel?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Controlled FSC fields for auto-fill
  const [licenseFsc, setLicenseFsc] = useState(purchaseOrder?.licenseFsc || "");
  const [chainOfCustody, setChainOfCustody] = useState(purchaseOrder?.chainOfCustody || "");
  const [inputClaim, setInputClaim] = useState(purchaseOrder?.inputClaim || "");
  const [outputClaim, setOutputClaim] = useState(purchaseOrder?.outputClaim || "");

  function handleSupplierChange(supplierId: string) {
    const supplier = suppliers.find(s => s.id === Number(supplierId));
    if (supplier?.fscLicense) setLicenseFsc(supplier.fscLicense);
    if (supplier?.fscChainOfCustody) setChainOfCustody(supplier.fscChainOfCustody);
    if (supplier?.fscInputClaim) setInputClaim(supplier.fscInputClaim);
    if (supplier?.fscOutputClaim) setOutputClaim(supplier.fscOutputClaim);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      poNumber: formData.get("poNumber") as string,
      poDate: (formData.get("poDate") as string) || undefined,
      clientId: Number(formData.get("clientId")),
      supplierId: Number(formData.get("supplierId")),
      clientPoNumber: (formData.get("clientPoNumber") as string) || undefined,
      sellPrice: Number(formData.get("sellPrice")),
      buyPrice: Number(formData.get("buyPrice")),
      product: formData.get("product") as string,
      terms: (formData.get("terms") as string) || undefined,
      transportType: (formData.get("transportType") as "ffcc" | "ship" | "truck") || undefined,
      licenseFsc: (formData.get("licenseFsc") as string) || undefined,
      chainOfCustody: (formData.get("chainOfCustody") as string) || undefined,
      inputClaim: (formData.get("inputClaim") as string) || undefined,
      outputClaim: (formData.get("outputClaim") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    startTransition(async () => {
      if (purchaseOrder) {
        await updatePurchaseOrder(purchaseOrder.id, data);
      } else {
        await createPurchaseOrder(data);
      }
      if (onCancel) onCancel();
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-md shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-4">
        {purchaseOrder ? "Edit Purchase Order" : "New Purchase Order"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">PO Number *</label>
            <input
              name="poNumber"
              required
              defaultValue={purchaseOrder?.poNumber || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="OC-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              name="poDate"
              type="date"
              defaultValue={purchaseOrder?.poDate || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client *</label>
            <select
              name="clientId"
              required
              defaultValue={purchaseOrder?.clientId || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier *</label>
            <select
              name="supplierId"
              required
              defaultValue={purchaseOrder?.supplierId || ""}
              onChange={(e) => handleSupplierChange(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <input
              name="product"
              required
              defaultValue={purchaseOrder?.product || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Pulp, Paper, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sell Price (USD/Ton) *</label>
            <input
              name="sellPrice"
              type="number"
              step="0.01"
              required
              defaultValue={purchaseOrder?.sellPrice || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Buy Price (USD/Ton) *</label>
            <input
              name="buyPrice"
              type="number"
              step="0.01"
              required
              defaultValue={purchaseOrder?.buyPrice || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Incoterm</label>
            <input
              name="terms"
              defaultValue={purchaseOrder?.terms || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="DAP, CIF, FOB..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Transport Type</label>
            <select
              name="transportType"
              defaultValue={purchaseOrder?.transportType || ""}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">Select</option>
              <option value="ffcc">Railroad</option>
              <option value="ship">Maritime</option>
              <option value="truck">Truck</option>
            </select>
          </div>
        </div>

        {/* Certification Fields */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">FSC Certification</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">FSC License</label>
              <input
                name="licenseFsc"
                value={licenseFsc}
                onChange={(e) => setLicenseFsc(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chain of Custody</label>
              <input
                name="chainOfCustody"
                value={chainOfCustody}
                onChange={(e) => setChainOfCustody(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Input Claim</label>
              <input
                name="inputClaim"
                value={inputClaim}
                onChange={(e) => setInputClaim(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Claim</label>
              <input
                name="outputClaim"
                value={outputClaim}
                onChange={(e) => setOutputClaim(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            name="notes"
            defaultValue={purchaseOrder?.notes || ""}
            rows={3}
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
            {isPending ? "Saving..." : purchaseOrder ? "Update" : "Create OC"}
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
