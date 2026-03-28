"use client";

import { useState, useTransition } from "react";
import { createClient, updateClient, deleteClient } from "@/server/actions";
import { useRouter } from "next/navigation";

type Client = {
  id: number;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  paymentTermsDays: number | null;
  accessToken: string;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ClientActions({ clients }: { clients: Client[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      contactName: (formData.get("contactName") as string) || undefined,
      contactEmail: (formData.get("contactEmail") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      paymentTermsDays: formData.get("paymentTermsDays") ? Number(formData.get("paymentTermsDays")) : null,
    };

    startTransition(async () => {
      if (editingClient) {
        await updateClient(editingClient.id, data);
      } else {
        await createClient(data);
      }
      setShowForm(false);
      setEditingClient(null);
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this client?")) return;
    startTransition(async () => {
      await deleteClient(id);
      router.refresh();
    });
  }

  function handleTogglePortal(client: Client) {
    startTransition(async () => {
      await updateClient(client.id, {
        name: client.name,
        portalEnabled: !client.portalEnabled,
      });
      router.refresh();
    });
  }

  function handleCopyLink(client: Client) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const link = `${base}/portal/${client.accessToken}`;
    navigator.clipboard.writeText(link);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleEdit(client: Client) {
    setEditingClient(client);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingClient(null);
  }

  return (
    <div className="space-y-4">
      {/* Action Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Client
        </button>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-md shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingClient ? "Edit Client" : "New Client"}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                name="name"
                required
                defaultValue={editingClient?.name || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact</label>
              <input
                name="contactName"
                defaultValue={editingClient?.contactName || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                name="contactEmail"
                type="email"
                defaultValue={editingClient?.contactEmail || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                name="phone"
                defaultValue={editingClient?.phone || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="Phone"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms (days)</label>
              <input
                name="paymentTermsDays"
                type="number"
                defaultValue={editingClient?.paymentTermsDays || ""}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="e.g. 60 for Net 60"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Saving..." : editingClient ? "Update" : "Create"}
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

      {/* Clients Table */}
      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Contact</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">Terms</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Portal</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Portal Link</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    No clients registered.
                  </td>
                </tr>
              )}
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="p-3 text-sm border-t border-border font-medium">{client.name}</td>
                  <td className="p-3 text-sm border-t border-border">{client.contactName || "-"}</td>
                  <td className="p-3 text-sm border-t border-border">{client.contactEmail || "-"}</td>
                  <td className="p-3 text-sm border-t border-border text-center">
                    {client.paymentTermsDays ? `Net ${client.paymentTermsDays}` : "-"}
                  </td>
                  <td className="p-3 text-sm border-t border-border">
                    <button
                      onClick={() => handleTogglePortal(client)}
                      disabled={isPending}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        client.portalEnabled
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {client.portalEnabled ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="p-3 text-sm border-t border-border">
                    {client.portalEnabled && (
                      <button
                        onClick={() => handleCopyLink(client)}
                        className="text-primary text-xs hover:underline"
                      >
                        {copiedId === client.id ? "Copied!" : "Copy link"}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right">
                    <div className="flex gap-2 justify-end">
                      <a
                        href={`/clients/${client.id}/send-report`}
                        className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:opacity-90"
                      >
                        Send Report
                      </a>
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        disabled={isPending}
                        className="text-xs text-destructive hover:underline"
                      >
                        Delete
                      </button>
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
