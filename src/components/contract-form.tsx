"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createContract, updateContract } from "@/server/actions";
import { useRouter } from "next/navigation";

type Client   = { id: number; name: string };
type Supplier = { id: number; name: string };
type PriceType = "fixed" | "cost_plus" | "market_plus";
type Status    = "draft" | "active" | "expired" | "cancelled";
type Frequency = "total" | "monthly" | "quarterly";

type ExistingContract = {
  id: number;
  contractNumber: string;
  clientId: number;
  supplierId: number;
  product?: string | null;
  status: Status;
  volumeTons?: number | null;
  volumeFrequency: Frequency;
  startDate?: string | null;
  endDate?: string | null;
  sellPriceType: PriceType;
  sellPrice?: number | null;
  sellMargin?: number | null;
  sellMarketRef?: string | null;
  sellIncoterm?: string | null;
  sellPaymentDays?: number | null;
  buyPriceType: PriceType;
  buyPrice?: number | null;
  buyMargin?: number | null;
  buyMarketRef?: string | null;
  buyIncoterm?: string | null;
  buyPaymentDays?: number | null;
  notes?: string | null;
};

type Props = {
  clients: Client[];
  suppliers: Supplier[];
  nextContractNumber: string;
  existing?: ExistingContract;
  onClose: () => void;
};

const INCOTERMS = ["DAP Eagle Pass, TX", "DAP Laredo, TX", "DAP El Paso, TX", "DAP Manzanillo", "DAP Veracruz", "FOB Origin", "CIF Destination", "CFR", "EXW"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 pt-2 pb-1 border-b border-stone-100">
      <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-stone-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b] focus:border-[#0d3d3b]";

function PriceSideFields({
  prefix,
  priceType, setType,
  price, setPrice,
  margin, setMargin,
  marketRef, setMarketRef,
  incoterm, setIncoterm,
  paymentDays, setPaymentDays,
}: {
  prefix: string;
  priceType: PriceType; setType: (v: PriceType) => void;
  price: string; setPrice: (v: string) => void;
  margin: string; setMargin: (v: string) => void;
  marketRef: string; setMarketRef: (v: string) => void;
  incoterm: string; setIncoterm: (v: string) => void;
  paymentDays: string; setPaymentDays: (v: string) => void;
}) {
  return (
    <>
      <Field label="Price Type">
        <select value={priceType} onChange={e => setType(e.target.value as PriceType)} className={inputCls}>
          <option value="fixed">Fixed ($/t)</option>
          <option value="cost_plus">Cost + Margin</option>
          <option value="market_plus">Market Reference + Margin</option>
        </select>
      </Field>

      {priceType === "fixed" && (
        <Field label="Price ($/t)">
          <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={inputCls} />
        </Field>
      )}
      {priceType === "cost_plus" && (
        <Field label="Margin over cost ($/t)">
          <input type="number" step="0.01" value={margin} onChange={e => setMargin(e.target.value)} placeholder="0.00" className={inputCls} />
        </Field>
      )}
      {priceType === "market_plus" && (
        <>
          <Field label="Market Reference">
            <input type="text" value={marketRef} onChange={e => setMarketRef(e.target.value)} placeholder="e.g. RISI NBSK NA" className={inputCls} />
          </Field>
          <Field label="Margin ($/t)">
            <input type="number" step="0.01" value={margin} onChange={e => setMargin(e.target.value)} placeholder="0.00" className={inputCls} />
          </Field>
        </>
      )}

      <Field label="Incoterm">
        <input list={`${prefix}-incoterms`} value={incoterm} onChange={e => setIncoterm(e.target.value)} placeholder="e.g. DAP Eagle Pass, TX" className={inputCls} />
        <datalist id={`${prefix}-incoterms`}>
          {INCOTERMS.map(t => <option key={t} value={t} />)}
        </datalist>
      </Field>

      <Field label="Payment Days">
        <input type="number" value={paymentDays} onChange={e => setPaymentDays(e.target.value)} placeholder="e.g. 60" className={inputCls} />
      </Field>
    </>
  );
}

export function ContractForm({ clients, suppliers, nextContractNumber, existing, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const e = existing;
  const [clientId,    setClientId]    = useState(String(e?.clientId   ?? ""));
  const [supplierId,  setSupplierId]  = useState(String(e?.supplierId ?? ""));
  const [product,     setProduct]     = useState(e?.product     ?? "");
  const [status,      setStatus]      = useState<Status>(e?.status ?? "draft");
  const [volumeTons,  setVolumeTons]  = useState(e?.volumeTons != null ? String(e.volumeTons) : "");
  const [volumeFreq,  setVolumeFreq]  = useState<Frequency>(e?.volumeFrequency ?? "total");
  const [startDate,   setStartDate]   = useState(e?.startDate  ?? "");
  const [endDate,     setEndDate]     = useState(e?.endDate    ?? "");
  const [notes,       setNotes]       = useState(e?.notes      ?? "");

  // Sell side
  const [sellType,       setSellType]       = useState<PriceType>(e?.sellPriceType ?? "fixed");
  const [sellPrice,      setSellPrice]      = useState(e?.sellPrice  != null ? String(e.sellPrice)  : "");
  const [sellMargin,     setSellMargin]     = useState(e?.sellMargin != null ? String(e.sellMargin) : "");
  const [sellMarketRef,  setSellMarketRef]  = useState(e?.sellMarketRef  ?? "");
  const [sellIncoterm,   setSellIncoterm]   = useState(e?.sellIncoterm   ?? "");
  const [sellPayDays,    setSellPayDays]    = useState(e?.sellPaymentDays != null ? String(e.sellPaymentDays) : "");

  // Buy side
  const [buyType,       setBuyType]       = useState<PriceType>(e?.buyPriceType ?? "fixed");
  const [buyPrice,      setBuyPrice]      = useState(e?.buyPrice  != null ? String(e.buyPrice)  : "");
  const [buyMargin,     setBuyMargin]     = useState(e?.buyMargin != null ? String(e.buyMargin) : "");
  const [buyMarketRef,  setBuyMarketRef]  = useState(e?.buyMarketRef  ?? "");
  const [buyIncoterm,   setBuyIncoterm]   = useState(e?.buyIncoterm   ?? "");
  const [buyPayDays,    setBuyPayDays]    = useState(e?.buyPaymentDays != null ? String(e.buyPaymentDays) : "");

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!clientId || !supplierId) return;

    const data = {
      clientId:   Number(clientId),
      supplierId: Number(supplierId),
      product:    product || null,
      status,
      volumeTons:       volumeTons  ? Number(volumeTons)  : null,
      volumeFrequency:  volumeFreq,
      startDate:  startDate || null,
      endDate:    endDate   || null,
      sellPriceType:   sellType,
      sellPrice:       sellPrice   ? Number(sellPrice)   : null,
      sellMargin:      sellMargin  ? Number(sellMargin)  : null,
      sellMarketRef:   sellMarketRef  || null,
      sellIncoterm:    sellIncoterm   || null,
      sellPaymentDays: sellPayDays ? Number(sellPayDays) : null,
      buyPriceType:    buyType,
      buyPrice:        buyPrice    ? Number(buyPrice)    : null,
      buyMargin:       buyMargin   ? Number(buyMargin)   : null,
      buyMarketRef:    buyMarketRef   || null,
      buyIncoterm:     buyIncoterm    || null,
      buyPaymentDays:  buyPayDays  ? Number(buyPayDays)  : null,
      notes: notes || null,
    };

    startTransition(async () => {
      if (existing) {
        await updateContract(existing.id, data);
      } else {
        const created = await createContract({ contractNumber: nextContractNumber, ...data });
        router.push(`/contracts/${created.id}`);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-stone-800">
            {existing ? `Edit ${existing.contractNumber}` : `New Contract · ${nextContractNumber}`}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">

            {/* General */}
            <SectionLabel>General</SectionLabel>

            <Field label="Client *">
              <select value={clientId} onChange={e => setClientId(e.target.value)} required className={inputCls}>
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Supplier *">
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required className={inputCls}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label="Product">
              <input type="text" value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. NBSK, OSB..." className={inputCls} />
            </Field>

            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as Status)} className={inputCls}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>

            <Field label="Start Date">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="End Date">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Volume Committed (t)">
              <input type="number" step="0.01" value={volumeTons} onChange={e => setVolumeTons(e.target.value)} placeholder="e.g. 5000" className={inputCls} />
            </Field>
            <Field label="Volume Frequency">
              <select value={volumeFreq} onChange={e => setVolumeFreq(e.target.value as Frequency)} className={inputCls}>
                <option value="total">Total</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </Field>

            {/* Sell side */}
            <SectionLabel>Client Terms (Sell)</SectionLabel>
            <PriceSideFields
              prefix="sell"
              priceType={sellType}       setType={setSellType}
              price={sellPrice}          setPrice={setSellPrice}
              margin={sellMargin}        setMargin={setSellMargin}
              marketRef={sellMarketRef}  setMarketRef={setSellMarketRef}
              incoterm={sellIncoterm}    setIncoterm={setSellIncoterm}
              paymentDays={sellPayDays}  setPaymentDays={setSellPayDays}
            />

            {/* Buy side */}
            <SectionLabel>Supplier Terms (Buy)</SectionLabel>
            <PriceSideFields
              prefix="buy"
              priceType={buyType}       setType={setBuyType}
              price={buyPrice}          setPrice={setBuyPrice}
              margin={buyMargin}        setMargin={setBuyMargin}
              marketRef={buyMarketRef}  setMarketRef={setBuyMarketRef}
              incoterm={buyIncoterm}    setIncoterm={setBuyIncoterm}
              paymentDays={buyPayDays}  setPaymentDays={setBuyPayDays}
            />

            {/* Notes */}
            <SectionLabel>Notes</SectionLabel>
            <div className="col-span-2">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." className={inputCls + " resize-none"} />
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-[#0d3d3b] text-white rounded-lg hover:bg-[#0a5c5a] disabled:opacity-50 font-medium">
              {isPending ? "Saving..." : existing ? "Save Changes" : "Create Contract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
