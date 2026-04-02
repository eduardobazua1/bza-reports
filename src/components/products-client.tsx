"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct, deleteProduct } from "@/server/actions";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

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
  description: string;
  fscLicense: string;
  chainOfCustody: string;
  inputClaim: string;
  outputClaim: string;
  pefc: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  grade: "",
  description: "",
  fscLicense: "",
  chainOfCustody: "",
  inputClaim: "",
  outputClaim: "",
  pefc: "",
  notes: "",
};

function formFromProduct(p: Product): FormState {
  return {
    name: p.name,
    grade: p.grade || "",
    description: p.description || "",
    fscLicense: p.fscLicense || "",
    chainOfCustody: p.chainOfCustody || "",
    inputClaim: p.inputClaim || "",
    outputClaim: p.outputClaim || "",
    pefc: p.pefc || "",
    notes: p.notes || "",
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
  const inp = "w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background";
  return (
    <>
      {/* Row 1: main fields */}
      <tr className={rowClass ?? "bg-teal-50/40 border-t border-border"}>
        <td className="p-2">
          <input
            autoFocus={autoFocus}
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Product name *"
            className={inp}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          />
        </td>
        <td className="p-2">
          <GradeSelect value={state.grade} onChange={(v) => onChange({ grade: v })} />
        </td>
        <td className="p-2">
          <input
            value={state.inputClaim}
            onChange={(e) => onChange({ inputClaim: e.target.value })}
            placeholder="Input claim"
            className={inp}
          />
        </td>
        <td className="p-2">
          <input
            value={state.chainOfCustody}
            onChange={(e) => onChange({ chainOfCustody: e.target.value })}
            placeholder="Chain of custody"
            className={inp}
          />
        </td>
        <td className="p-2">
          <input
            value={state.fscLicense}
            onChange={(e) => onChange({ fscLicense: e.target.value })}
            placeholder="FSC license"
            className={inp}
          />
        </td>
        <td className="p-2">
          <input
            value={state.pefc}
            onChange={(e) => onChange({ pefc: e.target.value })}
            placeholder="PEFC (optional)"
            className={inp}
          />
        </td>
        <td className="p-2 text-right" rowSpan={2}>
          <div className="flex gap-2 justify-end h-full items-start pt-1">
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
      {/* Row 2: secondary fields */}
      <tr className={rowClass ?? "bg-teal-50/40 border-b border-border"}>
        <td className="p-2" colSpan={2}>
          <input
            value={state.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description"
            className={inp}
          />
        </td>
        <td className="p-2">
          <input
            value={state.outputClaim}
            onChange={(e) => onChange({ outputClaim: e.target.value })}
            placeholder="Output claim"
            className={inp}
          />
        </td>
        <td className="p-2" colSpan={2}>
          <input
            value={state.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Notes"
            className={inp}
          />
        </td>
      </tr>
    </>
  );
}

export function ProductsClient({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [showAddRow, setShowAddRow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditForm(formFromProduct(p));
  }

  function cancelEdit() {
    setEditId(null);
  }

  function handleAdd() {
    if (!addForm.name.trim()) return;
    startTransition(async () => {
      await createProduct({
        name: addForm.name.trim(),
        grade: addForm.grade || undefined,
        description: addForm.description || undefined,
        fscLicense: addForm.fscLicense || undefined,
        chainOfCustody: addForm.chainOfCustody || undefined,
        inputClaim: addForm.inputClaim || undefined,
        outputClaim: addForm.outputClaim || undefined,
        pefc: addForm.pefc || undefined,
        notes: addForm.notes || undefined,
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
        description: editForm.description || undefined,
        fscLicense: editForm.fscLicense || undefined,
        chainOfCustody: editForm.chainOfCustody || undefined,
        inputClaim: editForm.inputClaim || undefined,
        outputClaim: editForm.outputClaim || undefined,
        pefc: editForm.pefc || undefined,
        notes: editForm.notes || undefined,
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
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Input Claim</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Chain of Custody</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">FSC License</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">PEFC</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
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

            {/* Empty state */}
            {products.length === 0 && !showAddRow && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  No products yet. Click &ldquo;+ Add Product&rdquo; to create one.
                </td>
              </tr>
            )}

            {/* Product rows */}
            {products.map((p) =>
              editId === p.id ? (
                <FormRow
                  key={p.id}
                  state={editForm}
                  onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                  onSave={handleUpdate}
                  onCancel={cancelEdit}
                  isPending={isPending}
                  autoFocus
                />
              ) : (
                <tr key={p.id} className="hover:bg-muted/50 transition-colors border-t border-border">
                  <td className="p-3 text-sm font-medium">
                    <div>{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {p.grade ? (
                      <span className="inline-block bg-teal-100 text-teal-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {p.grade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{p.inputClaim || "—"}</td>
                  <td className="p-3 text-sm font-mono text-xs text-muted-foreground">{p.chainOfCustody || "—"}</td>
                  <td className="p-3 text-sm font-mono text-xs text-muted-foreground">{p.fscLicense || "—"}</td>
                  <td className="p-3 text-sm font-mono text-xs text-muted-foreground">{p.pefc || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-stone-400 hover:text-stone-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
