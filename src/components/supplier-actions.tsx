"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createSupplier, updateSupplier, deleteSupplier } from "@/server/actions";
import { useRouter } from "next/navigation";

type Supplier = {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  totalCost?: number;
  totalPaid?: number;
  balance?: number;
};

export function SupplierActions({ suppliers }: { suppliers: Supplier[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      contactName: (formData.get("contactName") as string) || undefined,
      contactEmail: (formData.get("contactEmail") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
    };

    startTransition(async () => {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, data);
      } else {
        await createSupplier(data);
      }
      setShowForm(false);
      setEditingSupplier(null);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    startTransition(async () => {
      await deleteSupplier(id);
      router.refresh();
    });
  }

  function handleEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingSupplier(null);
  }

  return (
    <div className="space-y-4">
      {/* Action Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Supplier
        </button>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-md shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingSupplier ? "Edit Supplier" : "New Supplier"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                name="name"
                required
                defaultValue={editingSupplier?.name || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Supplier name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact</label>
              <input
                name="contactName"
                defaultValue={editingSupplier?.contactName || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="contactEmail"
                type="email"
                defaultValue={editingSupplier?.contactEmail || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                name="phone"
                defaultValue={editingSupplier?.phone || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Phone"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingSupplier ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Contact</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Phone</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Total Cost</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Paid</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Balance</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                    No suppliers registered.
                  </td>
                </tr>
              )}
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td className="p-3 text-sm border-t border-border font-medium">
                    <a href={`/suppliers/${supplier.id}`} className="text-primary hover:underline">{supplier.name}</a>
                  </td>
                  <td className="p-3 text-sm border-t border-border">{supplier.contactName || "-"}</td>
                  <td className="p-3 text-sm border-t border-border">{supplier.contactEmail || "-"}</td>
                  <td className="p-3 text-sm border-t border-border">{supplier.phone || "-"}</td>
                  <td className="p-3 text-sm border-t border-border text-right font-medium">
                    {supplier.totalCost ? `$${Math.round(supplier.totalCost).toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right text-green-600 font-medium">
                    {supplier.totalPaid ? `$${Math.round(supplier.totalPaid).toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right font-bold">
                    {supplier.balance !== undefined && supplier.balance !== 0 ? (
                      <span className={supplier.balance > 0 ? "text-red-600" : "text-green-600"}>
                        ${Math.abs(Math.round(supplier.balance)).toLocaleString()}
                      </span>
                    ) : <span className="text-green-600">Settled</span>}
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right">
                    <div className="relative inline-block" ref={openDropdownId === supplier.id ? dropdownRef : undefined}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === supplier.id ? null : supplier.id)}
                        className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors text-base leading-none"
                      >
                        ···
                      </button>
                      {openDropdownId === supplier.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 min-w-[130px] py-1 text-left">
                          <button onClick={() => { setOpenDropdownId(null); handleEdit(supplier); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Edit</button>
                          <div className="border-t border-stone-100 my-1" />
                          <button onClick={() => { setOpenDropdownId(null); handleDelete(supplier.id); }} disabled={isPending} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
