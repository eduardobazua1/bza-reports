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
  // FSC
  fscLicense?: string | null;
  chainOfCustody?: string | null;
  inputClaim?: string | null;
  outputClaim?: string | null;
  // PEFC
  pefc?: string | null;
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
  certType?: "fsc" | "pefc" | null;
  pefc?: string | null;
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

  const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background";

  // Cert state
  const [certType, setCertType] = useState<"" | "fsc" | "pefc">(purchaseOrder?.certType || "");
  const [licenseFsc, setLicenseFsc]     = useState(purchaseOrder?.licenseFsc || "");
  const [chainOfCustody, setChainOfCustody] = useState(purchaseOrder?.chainOfCustody || "");
  const [inputClaim, setInputClaim]     = useState(purchaseOrder?.inputClaim || "");
  const [outputClaim, setOutputClaim]   = useState(purchaseOrder?.outputClaim || "");
  const [pefc, setPefc]                 = useState(purchaseOrder?.pefc || "");

  // Product selects (kept for PDF naming)
  const [supplierProductId, setSupplierProductId] = useState<string>(
    purchaseOrder?.supplierProductId ? String(purchaseOrder.supplierProductId) : ""
  );
  const [clientProductId, setClientProductId] = useState<string>(
    purchaseOrder?.clientProductId ? String(purchaseOrder.clientProductId) : ""
  );

  function fillFromProduct(type: "fsc" | "pefc", prod: Product) {
    if (type === "fsc") {
      setLicenseFsc(prod.fscLicense || "");
      setChainOfCustody(prod.chainOfCustody || "");
      setInputClaim(prod.inputClaim || "");
      setOutputClaim(prod.outputClaim || "");
      setPefc("");
    } else {
      setPefc(prod.pefc || "");
      setInputClaim(prod.inputClaim || "");
      setChainOfCustody(prod.chainOfCustody || "");
      setOutputClaim(prod.outputClaim || "");
      setLicenseFsc("");
    }
  }

  function handleCertType(type: "" | "fsc" | "pefc") {
    setCertType(type);
    if (type === "") {
      setLicenseFsc(""); setChainOfCustody(""); setInputClaim(""); setOutputClaim(""); setPefc("");
      return;
    }
    // Auto-fill from selected supplier product if available
    const prod = products.find(p => String(p.id) === supplierProductId);
    if (prod) fillFromProduct(type, prod);
    else if (type === "fsc") setPefc("");
    else { setLicenseFsc(""); setChainOfCustody(""); setInputClaim(""); setOutputClaim(""); }
  }

  function handleSupplierProductChange(id: string) {
    setSupplierProductId(id);
    if (!id || !certType) return;
    const prod = products.find(p => String(p.id) === id);
    if (prod) fillFromProduct(certType as "fsc" | "pefc", prod);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      poNumber:        formData.get("poNumber") as string,
      poDate:          (formData.get("poDate") as string) || undefined,
      clientId:        Number(formData.get("clientId")),
      supplierId:      Number(formData.get("supplierId")),
      clientPoNumber:  (formData.get("clientPoNumber") as string) || undefined,
      sellPrice:       Number(formData.get("sellPrice")),
      buyPrice:        Number(formData.get("buyPrice")),
      product:         (formData.get("product") as string) || purchaseOrder?.product || "—",
      supplierProductId: supplierProductId ? Number(supplierProductId) : undefined,
      clientProductId:   clientProductId   ? Number(clientProductId)   : undefined,
      terms:           (formData.get("terms") as string) || undefined,
      transportType:   (formData.get("transportType") as "ffcc" | "ship" | "truck") || undefined,
      certType:        (certType as "fsc" | "pefc") || undefined,
      licenseFsc:      licenseFsc      || undefined,
      chainOfCustody:  chainOfCustody  || undefined,
      inputClaim:      inputClaim      || undefined,
      outputClaim:     outputClaim     || undefined,
      pefc:            pefc            || undefined,
      notes:           (formData.get("notes") as string) || undefined,
    };

    startTransition(async () => {
      if (purchaseOrder) await updatePurchaseOrder(purchaseOrder.id, data);
      else               await createPurchaseOrder(data);
      if (onCancel) onCancel();
      router.refresh();
    });
  }

  const certBtn = (type: "" | "fsc" | "pefc", label: string) => (
    <button
      key={type}
      type="button"
      onClick={() => handleCertType(type)}
      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
        certType === type
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white rounded-md shadow-sm p-4">
      <h3 className="text-lg font-semibold mb-4">
        {purchaseOrder ? "Edit Purchase Order" : "New Purchase Order"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Row 1: PO#, Date, Client PO# */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">PO Number *</label>
            <input name="poNumber" required defaultValue={purchaseOrder?.poNumber || ""} className={inp} placeholder="OC-001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input name="poDate" type="date" defaultValue={purchaseOrder?.poDate || ""} className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Client PO #</label>
            <input name="clientPoNumber" defaultValue={purchaseOrder?.clientPoNumber || ""} className={inp} />
          </div>
        </div>

        {/* Row 2: Client, Supplier + cert selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Client *</label>
            <Combobox name="clientId" options={clients} defaultId={purchaseOrder?.clientId} placeholder="Search client..." required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier *</label>
            <Combobox name="supplierId" options={suppliers} defaultId={purchaseOrder?.supplierId} placeholder="Search supplier..." required />
            <div className="flex gap-1 mt-2">
              {certBtn("", "None")}
              {certBtn("fsc", "FSC")}
              {certBtn("pefc", "PEFC")}
            </div>
          </div>
        </div>

        {/* Cert fields — only shown when FSC or PEFC selected */}
        {certType === "fsc" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">FSC License</label>
              <input value={licenseFsc} onChange={(e) => setLicenseFsc(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chain of Custody</label>
              <input value={chainOfCustody} onChange={(e) => setChainOfCustody(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Input Claim</label>
              <input value={inputClaim} onChange={(e) => setInputClaim(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Claim</label>
              <input value={outputClaim} onChange={(e) => setOutputClaim(e.target.value)} className={inp} />
            </div>
          </div>
        )}
        {certType === "pefc" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">PEFC Number</label>
              <input value={pefc} onChange={(e) => setPefc(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Input Claim</label>
              <input value={inputClaim} onChange={(e) => setInputClaim(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chain of Custody</label>
              <input value={chainOfCustody} onChange={(e) => setChainOfCustody(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Output Claim</label>
              <input value={outputClaim} onChange={(e) => setOutputClaim(e.target.value)} className={inp} />
            </div>
          </div>
        )}

        {/* Row 3: Product (for supplier PO), Client Product label, Sell Price, Buy Price, Incoterm, Transport */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product (Supplier PO)</label>
            <select value={supplierProductId} onChange={(e) => handleSupplierProductChange(e.target.value)} className={inp}>
              <option value="">— Free text —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!supplierProductId && (
              <input name="product" defaultValue={purchaseOrder?.product || ""} className={`${inp} mt-1`} placeholder="Product description" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Product (Client Invoice)</label>
            <select value={clientProductId} onChange={(e) => setClientProductId(e.target.value)} className={inp}>
              <option value="">— Same as supplier —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sell Price (USD/Ton) *</label>
            <input name="sellPrice" type="number" step="0.01" required defaultValue={purchaseOrder?.sellPrice || ""} className={inp} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cost (USD/Ton) *</label>
            <input name="buyPrice" type="number" step="0.01" required defaultValue={purchaseOrder?.buyPrice || ""} className={inp} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Incoterm</label>
            <input name="terms" defaultValue={purchaseOrder?.terms || ""} className={inp} placeholder="DAP, CIF, FOB..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Transport</label>
            <select name="transportType" defaultValue={purchaseOrder?.transportType || ""} className={inp}>
              <option value="">—</option>
              <option value="ffcc">Railroad</option>
              <option value="ship">Maritime</option>
              <option value="truck">Truck</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea name="notes" defaultValue={purchaseOrder?.notes || ""} rows={2} className={inp} />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {isPending ? "Saving..." : purchaseOrder ? "Update" : "Create PO"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
