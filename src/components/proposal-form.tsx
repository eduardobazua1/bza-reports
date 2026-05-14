"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createProposal, updateProposal } from "@/server/actions";
import { CreatableSelect } from "@/components/ui/creatable-select";

// ── Predefined option lists ───────────────────────────────────────────────────
const DEFAULT_INCOTERMS = [
  "DAP Eagle Pass, TX",
  "DAP Laredo, TX",
  "DAP El Paso, TX",
  "DAP Manzanillo, MX",
  "DAP Veracruz, MX",
  "FOB Origin",
  "CIF Destination",
  "CFR Veracruz",
  "EXW",
  "DDP",
];

const DEFAULT_PAYMENT_TERMS = [
  "Net 30",
  "Net 45",
  "Net 60",
  "Net 90",
  "Net 120",
  "COD",
  "Prepaid",
  "50% Advance / 50% on delivery",
];

const LS_INCOTERMS      = "bza_custom_incoterms";
const LS_PAYMENT_TERMS  = "bza_custom_payment_terms";

function loadCustom(key: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function saveCustom(key: string, items: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type LineItem = {
  id: string;
  sort: number;
  product: string;
  description: string;
  tons: string;
  unit: string;
  pricePerTon: string;
  certType: string;
  certDetail: string;
};

type Client  = { id: number; name: string };
type Product = { id: number; name: string; grade: string | null };

type ProposalFormProps = {
  mode: "new" | "edit";
  proposalId?: number;
  proposalNumber: string;
  clients: Client[];
  products: Product[];
  defaultValues?: {
    clientId: number;
    title: string;
    proposalDate: string;
    validUntil: string;
    status: "draft" | "sent" | "accepted" | "declined";
    incoterm: string;
    paymentTerms: string;
    notes: string;
    items: LineItem[];
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const UNIT_OPTIONS   = ["MT", "ADMT", "Ton"];
const CERT_OPTIONS   = ["FSC", "PEFC", "None"];
const STATUS_OPTIONS = ["draft", "sent", "accepted", "declined"] as const;

function emptyLine(idx: number): LineItem {
  return { id: uid(), sort: idx, product: "", description: "", tons: "", unit: "MT", pricePerTon: "", certType: "", certDetail: "" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProposalForm({ mode, proposalId, proposalNumber, clients, products, defaultValues }: ProposalFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Build initial product options from DB + any custom ones stored in state
  const dbProductNames = products.map(p => p.grade ? `${p.name} (${p.grade})` : p.name);

  const defaults = defaultValues ?? {
    clientId:     clients[0]?.id ?? 0,
    title:        "Proposal",
    proposalDate: new Date().toISOString().split("T")[0],
    validUntil:   "",
    status:       "draft" as const,
    incoterm:     "",
    paymentTerms: "",
    notes:        "",
    items:        [emptyLine(0)],
  };

  // ── Header state ─────────────────────────────────────────────────────────
  const [clientId,     setClientId]     = useState<number>(defaults.clientId);
  const [title,        setTitle]        = useState(defaults.title);
  const [proposalDate, setProposalDate] = useState(defaults.proposalDate);
  const [validUntil,   setValidUntil]   = useState(defaults.validUntil);
  const [status,       setStatus]       = useState<"draft"|"sent"|"accepted"|"declined">(defaults.status);
  const [incoterm,     setIncoterm]     = useState(defaults.incoterm);
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);
  const [notes,        setNotes]        = useState(defaults.notes);
  const [error,        setError]        = useState("");

  // ── Creatable option lists ────────────────────────────────────────────────
  // Incoterm options: default + saved custom
  const [incotermOpts, setIncotermOpts] = useState<string[]>(() => {
    const custom = loadCustom(LS_INCOTERMS);
    return [...DEFAULT_INCOTERMS, ...custom.filter(c => !DEFAULT_INCOTERMS.includes(c))];
  });
  function addIncoterm(val: string) {
    const next = [...incotermOpts, val];
    setIncotermOpts(next);
    const custom = loadCustom(LS_INCOTERMS);
    saveCustom(LS_INCOTERMS, [...custom, val]);
  }

  // Payment terms options: default + saved custom
  const [paymentOpts, setPaymentOpts] = useState<string[]>(() => {
    const custom = loadCustom(LS_PAYMENT_TERMS);
    return [...DEFAULT_PAYMENT_TERMS, ...custom.filter(c => !DEFAULT_PAYMENT_TERMS.includes(c))];
  });
  function addPaymentTerm(val: string) {
    const next = [...paymentOpts, val];
    setPaymentOpts(next);
    const custom = loadCustom(LS_PAYMENT_TERMS);
    saveCustom(LS_PAYMENT_TERMS, [...custom, val]);
  }

  // Per-line product options (DB products + custom ones added during this session)
  const [productOpts, setProductOpts] = useState<string[]>(dbProductNames);
  function addProduct(val: string) {
    setProductOpts(prev => [...prev, val]);
  }

  // ── Line items state ──────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>(defaults.items.length ? defaults.items : [emptyLine(0)]);

  function addLine() {
    setItems(prev => [...prev, emptyLine(prev.length)]);
  }
  function removeLine(id: string) {
    setItems(prev => prev.filter(i => i.id !== id).map((i, idx) => ({ ...i, sort: idx })));
  }
  function updateLine(id: string, field: keyof LineItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  // ── Grand total ───────────────────────────────────────────────────────────
  const grandTotal = items.reduce((s, i) => s + (parseFloat(i.tons) || 0) * (parseFloat(i.pricePerTon) || 0), 0);

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError("Please select a client."); return; }
    setError("");

    const payload = {
      proposalNumber,
      clientId,
      title: title || "Proposal",
      proposalDate,
      validUntil:   validUntil   || undefined,
      status,
      incoterm:     incoterm     || undefined,
      paymentTerms: paymentTerms || undefined,
      notes:        notes        || undefined,
      items: items.map((it, idx) => ({
        sort:         idx,
        product:      it.product,
        description:  it.description || undefined,
        tons:         parseFloat(it.tons)         || 0,
        unit:         it.unit,
        pricePerTon:  parseFloat(it.pricePerTon)  || 0,
        certType:     it.certType  || undefined,
        certDetail:   it.certDetail || undefined,
      })),
    };

    startTransition(async () => {
      try {
        if (mode === "new") {
          const id = await createProposal(payload);
          router.push(`/proposals/${id}`);
        } else if (proposalId) {
          await updateProposal(proposalId, payload);
          router.push(`/proposals/${proposalId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mode === "new" ? "New Proposal" : "Edit"}</h1>
          <p className="text-sm text-stone-400 mt-0.5 font-mono">{proposalNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 border border-stone-200 rounded-lg hover:bg-stone-50">
            Cancel
          </button>
          <button type="submit" disabled={pending}
            className="px-5 py-2 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
            {pending ? "Saving…" : (mode === "new" ? "Create Proposal" : "Save Changes")}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Header fields */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700 border-b border-stone-100 pb-2">Proposal Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Client */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs font-medium text-stone-600 mb-1">Client *</label>
            <CreatableSelect
              value={clients.find(c => c.id === clientId)?.name || ""}
              onChange={v => {
                const found = clients.find(c => c.name === v);
                if (found) setClientId(found.id);
              }}
              options={clients.map(c => c.name)}
              placeholder="Select client…"
            />
          </div>

          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-stone-600 mb-1">Title / Subject</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Pulp Supply Q3 2026"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
          </div>

          {/* Proposal Date */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Proposal Date *</label>
            <input type="date" value={proposalDate} onChange={e => setProposalDate(e.target.value)} required
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
          </div>

          {/* Valid Until */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Valid Until</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Status</label>
            <CreatableSelect
              value={status.charAt(0).toUpperCase() + status.slice(1)}
              onChange={v => setStatus(v.toLowerCase() as typeof status)}
              options={STATUS_OPTIONS.map(s => s.charAt(0).toUpperCase() + s.slice(1))}
              placeholder="Status"
            />
          </div>

          {/* Incoterm — CreatableSelect */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Incoterm</label>
            <CreatableSelect
              value={incoterm}
              onChange={setIncoterm}
              options={incotermOpts}
              onAddOption={addIncoterm}
              placeholder="Select or type…"
            />
          </div>

          {/* Payment Terms — CreatableSelect */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Payment Terms</label>
            <CreatableSelect
              value={paymentTerms}
              onChange={setPaymentTerms}
              options={paymentOpts}
              onAddOption={addPaymentTerm}
              placeholder="Select or type…"
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Line Items</h2>
          <button type="button" onClick={addLine}
            className="flex items-center gap-1.5 text-xs font-medium text-[#0d3d3b] hover:text-[#0a5c5a] transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Line
          </button>
        </div>

        {/* Column headers (desktop) */}
        <div className="hidden lg:grid grid-cols-[28px_1.8fr_1.4fr_90px_64px_108px_62px_88px_32px] gap-2 px-4 py-2 bg-stone-50 border-b border-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-400">
          <span />
          <span>Product</span>
          <span>Description / Notes</span>
          <span className="text-right">Tons</span>
          <span>Unit</span>
          <span className="text-right">Price / Ton</span>
          <span>Cert</span>
          <span>Cert Detail</span>
          <span />
        </div>

        <div className="divide-y divide-stone-50">
          {items.map((item, idx) => {
            const lineTotal = (parseFloat(item.tons) || 0) * (parseFloat(item.pricePerTon) || 0);
            return (
              <div key={item.id}
                className="px-4 py-3 space-y-2 lg:space-y-0 lg:grid lg:grid-cols-[28px_1.8fr_1.4fr_90px_64px_108px_62px_88px_32px] lg:gap-2 lg:items-center hover:bg-stone-50/50 transition-colors">

                {/* Row index */}
                <div className="hidden lg:flex items-center justify-center text-[10px] text-stone-300 font-mono select-none">
                  {idx + 1}
                </div>

                {/* Product — CreatableSelect */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Product *</label>
                  <CreatableSelect
                    value={item.product}
                    onChange={v => updateLine(item.id, "product", v)}
                    options={productOpts}
                    onAddOption={addProduct}
                    placeholder="Select or type…"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Description</label>
                  <input type="text" value={item.description}
                    onChange={e => updateLine(item.id, "description", e.target.value)}
                    placeholder="Specs, grade, etc."
                    className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>

                {/* Tons */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Tons</label>
                  <input type="number" value={item.tons}
                    onChange={e => updateLine(item.id, "tons", e.target.value)}
                    placeholder="0.000" step="0.001" min="0"
                    className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>

                {/* Unit */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Unit</label>
                  <CreatableSelect
                    value={item.unit}
                    onChange={v => updateLine(item.id, "unit", v)}
                    options={UNIT_OPTIONS}
                    placeholder="Unit"
                  />
                </div>

                {/* Price / ton */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Price / Ton</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                    <input type="number" value={item.pricePerTon}
                      onChange={e => updateLine(item.id, "pricePerTon", e.target.value)}
                      placeholder="0.00" step="0.01" min="0"
                      className="w-full border border-stone-200 rounded-lg pl-5 pr-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                  </div>
                </div>

                {/* Cert type */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Cert</label>
                  <CreatableSelect
                    value={item.certType}
                    onChange={v => updateLine(item.id, "certType", v)}
                    options={["—", ...CERT_OPTIONS]}
                    placeholder="—"
                  />
                </div>

                {/* Cert detail */}
                <div>
                  <label className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1 block">Cert Detail</label>
                  <input type="text" value={item.certDetail}
                    onChange={e => updateLine(item.id, "certDetail", e.target.value)}
                    placeholder="FSC-C005…"
                    className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30" />
                </div>

                {/* Delete + line total (mobile) */}
                <div className="flex items-center justify-between lg:justify-end gap-2">
                  <span className="lg:hidden text-xs text-stone-500 font-medium">
                    {lineTotal > 0 ? fmtUsd(lineTotal) : ""}
                  </span>
                  <button type="button" onClick={() => removeLine(item.id)}
                    disabled={items.length === 1}
                    className="text-stone-300 hover:text-red-400 transition-colors disabled:opacity-0 disabled:pointer-events-none" title="Remove line">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand total */}
        <div className="px-6 py-4 bg-[#0d3d3b]/5 border-t border-stone-100 flex items-center justify-between">
          <p className="text-xs text-stone-400">{items.length} line{items.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500">Grand Total</span>
            <span className="text-lg font-bold text-[#0d3d3b]">{fmtUsd(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <label className="block text-xs font-medium text-stone-600 mb-2">Notes & Terms</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
          placeholder="Payment terms, certification requirements, delivery conditions, validity…"
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d3d3b]/30 resize-none" />
      </div>

      {/* Bottom submit */}
      <div className="flex justify-end gap-3 pb-8">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 border border-stone-200 rounded-lg hover:bg-stone-50">
          Cancel
        </button>
        <button type="submit" disabled={pending}
          className="px-6 py-2 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : (mode === "new" ? "Create Proposal" : "Save Changes")}
        </button>
      </div>
    </form>
  );
}
