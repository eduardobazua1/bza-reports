"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createProduct, updateProduct, deleteProduct } from "@/server/actions";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  grade: string | null;
  description: string | null;
  notes: string | null;
  fscLicense: string | null;
  chainOfCustody: string | null;
  inputClaim: string | null;
  outputClaim: string | null;
  pefc: string | null;
  createdAt: string;
  updatedAt: string;
};

const GRADES = ["NBSK", "SBSK", "BHK", "BCTMP", "UKP", "Other"];

type CertMode = "none" | "fsc" | "pefc";

function GradeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
    >
      <option value="">—</option>
      {GRADES.map((g) => (
        <option key={g} value={g}>{g}</option>
      ))}
    </select>
  );
}

type FormState = {
  name: string;
  grade: string;
  fscLicense: string;
  chainOfCustody: string;
  inputClaim: string;
  outputClaim: string;
  pefc: string;
};

const emptyForm: FormState = {
  name: "", grade: "",
  fscLicense: "", chainOfCustody: "", inputClaim: "", outputClaim: "", pefc: "",
};

function certModeFromState(state: FormState): CertMode {
  if (state.pefc) return "pefc";
  if (state.fscLicense || state.inputClaim || state.chainOfCustody || state.outputClaim) return "fsc";
  return "none";
}

function formFromProduct(p: Product): FormState {
  return {
    name: p.name,
    grade: p.grade || "",
    fscLicense: p.fscLicense || "",
    chainOfCustody: p.chainOfCustody || "",
    inputClaim: p.inputClaim || "",
    outputClaim: p.outputClaim || "",
    pefc: p.pefc || "",
  };
}

function FormRow({
  state,
  onChange,
  onSave,
  onCancel,
  isPending,
  autoFocus,
  rowClass,
}: {
  state: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  autoFocus?: boolean;
  rowClass?: string;
}) {
  const [certMode, setCertMode] = useState<CertMode>(() => certModeFromState(state));
  const inp = "w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background";

  function handleCertMode(mode: CertMode) {
    setCertMode(mode);
    if (mode === "none") {
      onChange({ fscLicense: "", inputClaim: "", chainOfCustody: "", outputClaim: "", pefc: "" });
    } else if (mode === "fsc") {
      onChange({ pefc: "" });
    } else if (mode === "pefc") {
      onChange({ fscLicense: "" });
    }
  }

  return (
    <tr className={rowClass ?? "bg-teal-50/40 border-t border-b border-border"}>
      {/* Name */}
      <td className="p-2 align-top">
        <input
          autoFocus={autoFocus}
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Product name *"
          className={inp}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        />
      </td>
      {/* Grade */}
      <td className="p-2 align-top">
        <GradeSelect value={state.grade} onChange={(v) => onChange({ grade: v })} />
      </td>
      {/* Cert selector + fields */}
      <td className="p-2 align-top">
        <div className="flex gap-1 mb-2">
          {(["none", "fsc", "pefc"] as CertMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleCertMode(m)}
              className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                certMode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {m === "none" ? "None" : m.toUpperCase()}
            </button>
          ))}
        </div>
        {certMode === "fsc" && (
          <div className="flex flex-col gap-1">
            <input value={state.fscLicense} onChange={(e) => onChange({ fscLicense: e.target.value })} placeholder="License" className={inp} />
            <input value={state.inputClaim} onChange={(e) => onChange({ inputClaim: e.target.value })} placeholder="Input claim" className={inp} />
            <input value={state.chainOfCustody} onChange={(e) => onChange({ chainOfCustody: e.target.value })} placeholder="Chain of custody" className={inp} />
            <input value={state.outputClaim} onChange={(e) => onChange({ outputClaim: e.target.value })} placeholder="Output claim" className={inp} />
          </div>
        )}
        {certMode === "pefc" && (
          <div className="flex flex-col gap-1">
            <input value={state.pefc} onChange={(e) => onChange({ pefc: e.target.value })} placeholder="PEFC number" className={inp} />
            <input value={state.inputClaim} onChange={(e) => onChange({ inputClaim: e.target.value })} placeholder="Input claim" className={inp} />
            <input value={state.chainOfCustody} onChange={(e) => onChange({ chainOfCustody: e.target.value })} placeholder="Chain of custody" className={inp} />
            <input value={state.outputClaim} onChange={(e) => onChange({ outputClaim: e.target.value })} placeholder="Output claim" className={inp} />
          </div>
        )}
      </td>
      {/* Actions */}
      <td className="p-2 text-right align-top">
        <div className="flex gap-2 justify-end">
          <button
            onClick={onSave}
            disabled={isPending || !state.name.trim()}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onCancel}
            className="border border-border px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function CertDisplay({ p }: { p: Product }) {
  const hasFsc = !!(p.fscLicense || p.inputClaim || p.chainOfCustody || p.outputClaim);
  if (p.pefc) return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="font-medium">PEFC</span>
      {p.pefc && <span className="text-xs font-mono text-muted-foreground">{p.pefc}</span>}
      {p.inputClaim && <span className="text-xs text-muted-foreground">{p.inputClaim}</span>}
    </div>
  );
  if (hasFsc) return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="font-medium">FSC</span>
      {p.fscLicense && <span className="text-xs font-mono text-muted-foreground">{p.fscLicense}</span>}
      {p.inputClaim && <span className="text-xs text-muted-foreground">{p.inputClaim}</span>}
    </div>
  );
  return <span className="text-muted-foreground text-sm">—</span>;
}

export function ProductsClient({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [showAddRow, setShowAddRow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditForm(formFromProduct(p));
  }

  function handleAdd() {
    if (!addForm.name.trim()) return;
    startTransition(async () => {
      await createProduct({
        name: addForm.name.trim(),
        grade: addForm.grade || undefined,
        fscLicense: addForm.fscLicense || undefined,
        chainOfCustody: addForm.chainOfCustody || undefined,
        inputClaim: addForm.inputClaim || undefined,
        outputClaim: addForm.outputClaim || undefined,
        pefc: addForm.pefc || undefined,
      });
      setShowAddRow(false);
      setAddForm(emptyForm);
      router.refresh();
    });
  }

  function handleUpdate() {
    if (!editForm.name.trim() || editId === null) return;
    startTransition(async () => {
      await updateProduct(editId, {
        name: editForm.name.trim(),
        grade: editForm.grade || undefined,
        fscLicense: editForm.fscLicense || undefined,
        chainOfCustody: editForm.chainOfCustody || undefined,
        inputClaim: editForm.inputClaim || undefined,
        outputClaim: editForm.outputClaim || undefined,
        pefc: editForm.pefc || undefined,
      });
      setEditId(null);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteProduct(id);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-md shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? "s" : ""}</span>
        {!showAddRow && (
          <button
            onClick={() => { setShowAddRow(true); setEditId(null); }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add Product
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Grade</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Certification</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {showAddRow && (
              <FormRow
                state={addForm}
                onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
                onSave={handleAdd}
                onCancel={() => { setShowAddRow(false); setAddForm(emptyForm); }}
                isPending={isPending}
                autoFocus
              />
            )}

            {products.length === 0 && !showAddRow && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                  No products yet. Click &ldquo;+ Add Product&rdquo; to create one.
                </td>
              </tr>
            )}

            {products.map((p) =>
              editId === p.id ? (
                <FormRow
                  key={p.id}
                  state={editForm}
                  onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                  onSave={handleUpdate}
                  onCancel={() => setEditId(null)}
                  isPending={isPending}
                  autoFocus
                />
              ) : (
                <tr key={p.id} className="hover:bg-muted/50 transition-colors border-t border-border">
                  <td className="p-3 text-sm font-medium">{p.name}</td>
                  <td className="p-3 text-sm">
                    {p.grade ? (
                      <span className="inline-block bg-teal-100 text-teal-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {p.grade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <CertDisplay p={p} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="relative inline-block" ref={openDropdownId === p.id ? dropdownRef : undefined}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                        className="text-xs text-primary font-medium px-2 py-1 hover:bg-blue-50 rounded border border-stone-200"
                      >
                        ▼
                      </button>
                      {openDropdownId === p.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 min-w-[130px] py-1 text-left">
                          <button onClick={() => { setOpenDropdownId(null); startEdit(p); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Edit</button>
                          <div className="border-t border-stone-100 my-1" />
                          <button onClick={() => { setOpenDropdownId(null); handleDelete(p.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
