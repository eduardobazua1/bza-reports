"use client";

import { useState, useTransition } from "react";
import { updateSupplier, deleteSupplier } from "@/server/actions";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
  country: string | null; city: string | null; state: string | null; zip: string | null;
  address: string | null; website: string | null; notes: string | null;
  contactName: string | null; contactEmail: string | null; phone: string | null;
  bankName: string | null; bankBeneficiary: string | null; bankAccount: string | null;
  bankRouting: string | null; bankSwift: string | null; bankAddress: string | null;
  certType: string | null; fscLicense: string | null; fscChainOfCustody: string | null;
  fscInputClaim: string | null; fscOutputClaim: string | null; pefc: string | null;
};

function F({ label, name, dv, ph, type }: { label: string; name: string; dv?: string | null; ph?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-stone-500 mb-1">{label}</label>
      <input name={name} type={type || "text"} defaultValue={dv || ""} placeholder={ph || ""} className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#0d3d3b]" />
    </div>
  );
}

function ST({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-3">{children}</p>;
}

export function SupplierDetailEdit({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false);
  const [certType, setCertType] = useState(supplier.certType || "fsc");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const g = (k: string) => (formData.get(k) as string) || undefined;
    const data = {
      name: formData.get("name") as string,
      country: g("country"), city: g("city"), state: g("state"), zip: g("zip"),
      address: g("address"), website: g("website"), notes: g("notes"),
      contactName: g("contactName"), contactEmail: g("contactEmail"), phone: g("phone"),
      bankName: g("bankName"), bankBeneficiary: g("bankBeneficiary"), bankAccount: g("bankAccount"),
      bankRouting: g("bankRouting"), bankSwift: g("bankSwift"), bankAddress: g("bankAddress"),
      certType: g("certType"),
      fscLicense: g("fscLicense"), fscChainOfCustody: g("fscChainOfCustody"),
      fscInputClaim: g("fscInputClaim"), fscOutputClaim: g("fscOutputClaim"), pefc: g("pefc"),
    };
    startTransition(async () => {
      await updateSupplier(supplier.id, data);
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${supplier.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteSupplier(supplier.id);
      router.push("/suppliers");
    });
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="border border-stone-200 px-3 py-1.5 rounded text-sm text-stone-700 hover:bg-stone-50 font-medium"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="border border-red-200 px-3 py-1.5 rounded text-sm text-red-600 hover:bg-red-50 font-medium disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12 px-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mb-12">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h3 className="text-base font-semibold text-stone-800">Edit — {supplier.name}</h3>
          <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-700 text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-6 overflow-y-auto max-h-[75vh]">

          {/* Name & Contact */}
          <section>
            <ST>Name &amp; Contact</ST>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><F label="Company Name *" name="name" dv={supplier.name} ph="Supplier name" /></div>
              <F label="Website" name="website" dv={supplier.website} ph="www.example.com" />
              <F label="Contact Name" name="contactName" dv={supplier.contactName} ph="Full name" />
              <F label="Email" name="contactEmail" type="email" dv={supplier.contactEmail} ph="email@supplier.com" />
              <F label="Phone" name="phone" dv={supplier.phone} ph="+1 555 000 0000" />
            </div>
          </section>

          {/* Address */}
          <section>
            <ST>Address</ST>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><F label="Street Address" name="address" dv={supplier.address} ph="Street address" /></div>
              <F label="City" name="city" dv={supplier.city} ph="City" />
              <F label="State / Province" name="state" dv={supplier.state} ph="State or Province" />
              <F label="ZIP / Postal Code" name="zip" dv={supplier.zip} ph="ZIP" />
              <F label="Country" name="country" dv={supplier.country} ph="e.g. Canada" />
            </div>
          </section>

          {/* Bank / ACH */}
          <section>
            <ST>Bank / ACH Info</ST>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><F label="Bank Name" name="bankName" dv={supplier.bankName} ph="e.g. Royal Bank of Canada" /></div>
              <F label="Beneficiary" name="bankBeneficiary" dv={supplier.bankBeneficiary} ph="Account holder name" />
              <F label="Account Number" name="bankAccount" dv={supplier.bankAccount} ph="Account number" />
              <F label="Routing / ABA" name="bankRouting" dv={supplier.bankRouting} ph="Routing number" />
              <F label="SWIFT / BIC" name="bankSwift" dv={supplier.bankSwift} ph="e.g. ROYCCAT2" />
              <div className="sm:col-span-2"><F label="Bank Address" name="bankAddress" dv={supplier.bankAddress} ph="Bank branch address" /></div>
            </div>
          </section>

          {/* Certification */}
          <section>
            <ST>Certification</ST>
            <div className="flex gap-4 mb-3">
              {(["fsc", "pefc", "none"] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="certType" value={t} checked={certType === t} onChange={() => setCertType(t)} className="accent-[#0d3d3b]" />
                  <span className="font-medium">{t === "none" ? "None" : t.toUpperCase()}</span>
                </label>
              ))}
            </div>
            {certType === "fsc" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="FSC License" name="fscLicense" dv={supplier.fscLicense} ph="FSC-C000000" />
                <F label="Chain of Custody" name="fscChainOfCustody" dv={supplier.fscChainOfCustody} ph="SCS-COC-000000" />
                <F label="Input Claim" name="fscInputClaim" dv={supplier.fscInputClaim} ph="e.g. FSC Controlled Wood" />
                <F label="Output Claim" name="fscOutputClaim" dv={supplier.fscOutputClaim} ph="e.g. FSC Controlled Wood" />
              </div>
            )}
            {certType === "pefc" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="PEFC License #" name="pefc" dv={supplier.pefc} ph="e.g. PEFC-01-31-123" />
                <F label="Chain of Custody" name="fscChainOfCustody" dv={supplier.fscChainOfCustody} />
              </div>
            )}
          </section>

          {/* Notes */}
          <section>
            <ST>Notes</ST>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Notes</label>
              <textarea name="notes" defaultValue={supplier.notes || ""} rows={3} placeholder="Internal notes about this supplier..." className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#0d3d3b] resize-none" />
            </div>
          </section>

          <div className="flex gap-2 pt-2 border-t border-stone-100">
            <button type="submit" disabled={isPending} className="bg-[#0d3d3b] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {isPending ? "Saving..." : "Update Supplier"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
