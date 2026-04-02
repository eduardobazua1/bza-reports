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

export function ProductsClient({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [showAddRow, setShowAddRow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addGrade, setAddGrade] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addNotes, setAddNotes] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editNotes, setEditNotes] = useState("");

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditName(p.name);
    setEditGrade(p.grade || "");
    setEditDesc(p.description || "");
    setEditNotes(p.notes || "");
  }

  function cancelEdit() {
    setEditId(null);
  }

  function handleAdd() {
    if (!addName.trim()) return;
    startTransition(async () => {
      await createProduct({
        name: addName.trim(),
        grade: addGrade || undefined,
        description: addDesc || undefined,
        notes: addNotes || undefined,
      });
      setShowAddRow(false);
      setAddName("");
      setAddGrade("");
      setAddDesc("");
      setAddNotes("");
      router.refresh();
    });
  }

  function handleUpdate() {
    if (!editName.trim() || editId === null) return;
    startTransition(async () => {
      await updateProduct(editId, {
        name: editName.trim(),
        grade: editGrade || undefined,
        description: editDesc || undefined,
        notes: editNotes || undefined,
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
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Description</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Notes</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {showAddRow && (
              <tr className="bg-teal-50/40 border-t border-border">
                <td className="p-2">
                  <input
                    autoFocus
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Product name *"
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAddRow(false); }}
                  />
                </td>
                <td className="p-2">
                  <GradeSelect value={addGrade} onChange={setAddGrade} />
                </td>
                <td className="p-2">
                  <input
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="Notes"
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                  />
                </td>
                <td className="p-2 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleAdd}
                      disabled={isPending || !addName.trim()}
                      className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setShowAddRow(false)}
                      className="border border-border px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {products.length === 0 && !showAddRow && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No products yet. Click &ldquo;+ Add Product&rdquo; to create one.
                </td>
              </tr>
            )}

            {/* Product rows */}
            {products.map((p) =>
              editId === p.id ? (
                <tr key={p.id} className="bg-teal-50/40 border-t border-border">
                  <td className="p-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                    />
                  </td>
                  <td className="p-2">
                    <GradeSelect value={editGrade} onChange={setEditGrade} />
                  </td>
                  <td className="p-2">
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleUpdate}
                        disabled={isPending || !editName.trim()}
                        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="border border-border px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
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
                  <td className="p-3 text-sm text-muted-foreground">{p.description || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{p.notes || "—"}</td>
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
