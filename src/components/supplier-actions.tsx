"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { createSupplier, deleteSupplier } from "@/server/actions";
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

function SupplierForm({ initial, onSave, onCancel, isPending }: {
  initial?: Supplier | null; onSave: (d: FormData) => void; onCancel: () => void; isPending: boolean;
}) {
  const [certType, setCertType] = useState(initial?.certType || "fsc");
  return (
    <div className="bg-white rounded-md shadow-sm p-5">
      <h3 className="text-base font-semibold text-stone-800 mb-5">{initial ? `Edit — ${initial.name}` : "New Supplier"}</h3>
      <form onSubmit={e => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="space-y-6">

        {/* Name & Contact */}
        <section>
          <ST>Name &amp; Contact</ST>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><F label="Company Name *" name="name" dv={initial?.name} ph="Supplier name" /></div>
            <F label="Website" name="website" dv={initial?.website} ph="www.example.com" />
            <F label="Contact Name" name="contactName" dv={initial?.contactName} ph="Full name" />
            <F label="Email" name="contactEmail" type="email" dv={initial?.contactEmail} ph="email@supplier.com" />
            <F label="Phone" name="phone" dv={initial?.phone} ph="+1 555 000 0000" />
          </div>
        </section>

        {/* Address */}
        <section>
          <ST>Address</ST>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><F label="Street Address" name="address" dv={initial?.address} ph="Street address" /></div>
            <F label="City" name="city" dv={initial?.city} ph="City" />
            <F label="State / Province" name="state" dv={initial?.state} ph="State or Province" />
            <F label="ZIP / Postal Code" name="zip" dv={initial?.zip} ph="ZIP" />
            <F label="Country" name="country" dv={initial?.country} ph="e.g. Canada" />
          </div>
        </section>

        {/* Bank / ACH */}
        <section>
          <ST>Bank / ACH Info</ST>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><F label="Bank Name" name="bankName" dv={initial?.bankName} ph="e.g. Royal Bank of Canada" /></div>
            <F label="Beneficiary" name="bankBeneficiary" dv={initial?.bankBeneficiary} ph="Account holder name" />
            <F label="Account Number" name="bankAccount" dv={initial?.bankAccount} ph="Account number" />
            <F label="Routing / ABA" name="bankRouting" dv={initial?.bankRouting} ph="Routing number" />
            <F label="SWIFT / BIC" name="bankSwift" dv={initial?.bankSwift} ph="e.g. ROYCCAT2" />
            <div className="sm:col-span-2"><F label="Bank Address" name="bankAddress" dv={initial?.bankAddress} ph="Bank branch address" /></div>
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
              <F label="FSC License" name="fscLicense" dv={initial?.fscLicense} ph="FSC-C000000" />
              <F label="Chain of Custody" name="fscChainOfCustody" dv={initial?.fscChainOfCustody} ph="SCS-COC-000000" />
              <F label="Input Claim" name="fscInputClaim" dv={initial?.fscInputClaim} ph="e.g. FSC Controlled Wood" />
              <F label="Output Claim" name="fscOutputClaim" dv={initial?.fscOutputClaim} ph="e.g. FSC Controlled Wood" />
            </div>
          )}
          {certType === "pefc" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <F label="PEFC License #" name="pefc" dv={initial?.pefc} ph="e.g. PEFC-01-31-123" />
              <F label="Chain of Custody" name="fscChainOfCustody" dv={initial?.fscChainOfCustody} />
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <ST>Notes</ST>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Notes</label>
            <textarea name="notes" defaultValue={initial?.notes || ""} rows={3} placeholder="Internal notes about this supplier..." className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#0d3d3b] resize-none" />
          </div>
        </section>

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="bg-[#0d3d3b] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {isPending ? "Saving..." : initial ? "Update" : "Create"}
          </button>
          <button type="button" onClick={onCancel} className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export function SupplierActions({ suppliers }: { suppliers: Supplier[] }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdownId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSave(formData: FormData) {
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
      await createSupplier(data);
      setShowForm(false); router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this supplier?")) return;
    startTransition(async () => { await deleteSupplier(id); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="bg-[#0d3d3b] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90">
          + New Supplier
        </button>
      )}
      {showForm && (
        <SupplierForm initial={null} onSave={handleSave} onCancel={() => setShowForm(false)} isPending={isPending} />
      )}

      <div className="bg-white rounded-md shadow-sm">
        <table className="w-full">
          <thead className="bg-stone-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Contact</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Location</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Cert</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-sm text-stone-400">No suppliers registered.</td></tr>
            )}
            {suppliers.map(s => (
              <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50/60">
                <td className="px-4 py-3 text-sm font-medium">
                  <a href={`/suppliers/${s.id}`} className="text-[#0d3d3b] hover:underline">{s.name}</a>
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">{s.contactName || "—"}</td>
                <td className="px-4 py-3 text-sm text-stone-500">{s.contactEmail || "—"}</td>
                <td className="px-4 py-3 text-sm text-stone-500">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-sm">
                  {s.certType === "fsc" || s.fscLicense ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">FSC</span>
                  ) : s.certType === "pefc" || s.pefc ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">PEFC</span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      if (openDropdownId === s.id) { setOpenDropdownId(null); return; }
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const estimatedH = 120;
                      const spaceBelow = window.innerHeight - r.bottom;
                      const top = spaceBelow < estimatedH ? r.top - estimatedH - 4 : r.bottom + 4;
                      setDropdownPos({ top, right: window.innerWidth - r.right });
                      setOpenDropdownId(s.id);
                    }}
                    className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors text-base leading-none"
                  >···</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openDropdownId !== null && dropdownPos && (() => {
        const supplier = suppliers.find(x => x.id === openDropdownId);
        if (!supplier) return null;
        return createPortal(
          <div ref={dropdownRef} style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }} className="bg-white border border-stone-200 rounded-md shadow-lg min-w-[130px] py-1 text-left">
            <a href={`/suppliers/${supplier.id}`} className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">View Detail</a>
            <div className="border-t border-stone-100 my-1" />
            <button onClick={() => { setOpenDropdownId(null); handleDelete(supplier.id); }} disabled={isPending} className="w-full text-left px-4 py-2 text-sm text-[#0d3d3b] hover:bg-[#0d3d3b]">Delete</button>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
