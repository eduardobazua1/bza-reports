"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPurchaseOrder, updatePurchaseOrder } from "@/server/actions";
import { useRouter } from "next/navigation";

function Combobox({
  name,
  options,
  defaultId,
  placeholder,
  required,
  onSelect,
}: {
  name: string;
  options: { id: number; name: string }[];
  defaultId?: number | string;
  placeholder?: string;
  required?: boolean;
  onSelect?: (id: number) => void;
}) {
  const initial = options.find(o => o.id === Number(defaultId));
  const [query, setQuery] = useState(initial?.name || "");
  const [selectedId, setSelectedId] = useState<number | "">(initial?.id ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(option: { id: number; name: string }) {
    setSelectedId(option.id);
    setQuery(option.name);
    setOpen(false);
    onSelect?.(option.id);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        placeholder={placeholder}
        value={query}
        required={required}
        onChange={(e) => { setQuery(e.target.value); setSelectedId(""); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedId} required={required} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <div
              key={o.id}
              onMouseDown={() => select(o)}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-muted ${o.id === selectedId ? "bg-muted font-medium" : ""}`}
            >
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

type Product = {
  id: number;
  name: string;
  grade?: string | null;
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

// Button to trigger inline form on the list page
export function POListActions({
  clients,
  suppliers,
  products,
}: {
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
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
          products={products}
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
  products,
  onCancel,
}: {
  purchaseOrder?: PurchaseOrder;
  clients: Client[];
  suppliers: Supplier[];
  products: Product[];
  onCancel?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Controlled FSC fields for auto-fill
  const [licenseFsc, setLicenseFsc] = useState(purchaseOrder?.licenseFsc || "");
  const [chainOfCustody, setChainOfCustody] = useState(purchaseOrder?.chainOfCustody || "");
  const [inputClaim, setInputClaim] = useState(purchaseOrder?.inputClaim || "");
  const [outputClaim, setOutputClaim] = useState(purchaseOrder?.outputClaim || "FSC Controlled Wood");

  // Product selects
  const [supplierProductId, setSupplierProductId] = useState<string>(
    purchaseOrder?.supplierProductId ? String(purchaseOrder.supplierProductId) : ""
  );
  const [clientProductId, setClientProductId] = useState<string>(
    purchaseOrder?.clientProductId ? String(purchaseOrder.clientProductId) : ""
  );

  function handleSupplierChange(supplierId: number) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.fscLicense) setLicenseFsc(supplier.fscLicense);
    if (supplier?.fscChainOfCustody) setChainOfCustody(supplier.fscChainOfCustody);
    if (supplier?.fscInputClaim) setInputClaim(supplier.fscInputClaim);
    if (supplier?.fscOutputClaim) setOutputClaim(supplier.fscOutputClaim);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const supplierProdId = supplierProductId ? Number(supplierProductId) : undefined;
    const clientProdId = clientProductId ? Number(clientProductId) : undefined;
    // Fallback product text: prefer supplier product name, else keep existing
    const supplierProdName = supplierProdId
      ? (products.find(p => p.id === supplierProdId)?.name || "")
      : "";
    const productText = supplierProdName || (formData.get("productFallback") as string) || "";

    const data = {
      poNumber: formData.get("poNumber") as string,
      poDate: (formData.get("poDate") as string) || undefined,
      clientId: Number(formData.get("clientId")),
      supplierId: Number(formData.get("supplierId")),
      clientPoNumber: (formData.get("clientPoNumber") as string) || undefined,
      sellPrice: Number(formData.get("sellPrice")),
      buyPrice: Number(formData.get("buyPrice")),
      product: productText || "—",
      supplierProductId: supplierProdId,
      clientProductId: clientProdId,
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
            <Combobox
              name="clientId"
              options={clients}
              defaultId={purchaseOrder?.clientId}
              placeholder="Search client..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier *</label>
            <Combobox
              name="supplierId"
              options={suppliers}
              defaultId={purchaseOrder?.supplierId}
              placeholder="Search supplier..."
              required
              onSelect={handleSupplierChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier Product</label>
            <select
              value={supplierProductId}
              onChange={(e) => setSupplierProductId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.grade ? ` (${p.grade})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client Product</label>
            <select
              value={clientProductId}
              onChange={(e) => setClientProductId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="">— Same as supplier —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.grade ? ` (${p.grade})` : ""}
                </option>
              ))}
            </select>
          </div>
          {/* Hidden fallback: keeps existing product text for backward compat */}
          <input type="hidden" name="productFallback" value={purchaseOrder?.product || ""} />
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
