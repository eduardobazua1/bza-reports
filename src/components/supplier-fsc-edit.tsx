"use client";

import { useState, useTransition } from "react";
import { updateSupplier } from "@/server/actions";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  fscLicense?: string | null;
  fscChainOfCustody?: string | null;
  fscInputClaim?: string | null;
  fscOutputClaim?: string | null;
};

export function SupplierFscEdit({ supplier }: { supplier: Supplier }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [fscLicense, setFscLicense] = useState(supplier.fscLicense || "");
  const [chainOfCustody, setChainOfCustody] = useState(supplier.fscChainOfCustody || "");
  const [inputClaim, setInputClaim] = useState(supplier.fscInputClaim || "");
  const [outputClaim, setOutputClaim] = useState(supplier.fscOutputClaim || "");

  function handleSave() {
    startTransition(async () => {
      await updateSupplier(supplier.id, {
        name: supplier.name,
        contactName: supplier.contactName || undefined,
        contactEmail: supplier.contactEmail || undefined,
        phone: supplier.phone || undefined,
        fscLicense: fscLicense || undefined,
        fscChainOfCustody: chainOfCustody || undefined,
        fscInputClaim: inputClaim || undefined,
        fscOutputClaim: outputClaim || undefined,
      });
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="bg-white rounded-md shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">FSC Certification</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">License</p>
            <p className="font-medium">{supplier.fscLicense || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Chain of Custody</p>
            <p className="font-medium">{supplier.fscChainOfCustody || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Input Claim</p>
            <p className="font-medium">{supplier.fscInputClaim || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-0.5">Output Claim</p>
            <p className="font-medium">{supplier.fscOutputClaim || "—"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md shadow-sm p-4">
      <h3 className="font-semibold text-stone-800 mb-3">FSC Certification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-stone-500 mb-1">FSC License</label>
          <input
            className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
            value={fscLicense}
            onChange={(e) => setFscLicense(e.target.value)}
            placeholder="FSC-C000000"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Chain of Custody</label>
          <input
            className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
            value={chainOfCustody}
            onChange={(e) => setChainOfCustody(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Input Claim</label>
          <input
            className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
            value={inputClaim}
            onChange={(e) => setInputClaim(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Output Claim</label>
          <input
            className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
            value={outputClaim}
            onChange={(e) => setOutputClaim(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-stone-500 hover:text-stone-700 px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
