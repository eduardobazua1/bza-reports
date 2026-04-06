"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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

type PortalUser = {
  id: number;
  clientId: number;
  email: string;
  name: string;
  isActive: boolean;
  lastLogin: string | null;
};

export function ClientActions({ clients }: { clients: Client[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalUsersClientId, setPortalUsersClientId] = useState<number | null>(null);
  const [portalUsersList, setPortalUsersList] = useState<PortalUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [puLoading, setPuLoading] = useState(false);
  const router = useRouter();

  // Load portal users when panel opens
  useEffect(() => {
    if (portalUsersClientId) {
      fetch(`/api/portal-users?clientId=${portalUsersClientId}`)
        .then(r => r.json())
        .then(setPortalUsersList)
        .catch(() => {});
    }
  }, [portalUsersClientId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleAddPortalUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newName || !portalUsersClientId) return;
    setPuLoading(true);
    const res = await fetch("/api/portal-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: portalUsersClientId, email: newEmail, name: newName }),
    });
    if (res.ok) {
      const user = await res.json();
      setPortalUsersList(prev => [...prev, user]);
      setNewEmail("");
      setNewName("");
    } else {
      const data = await res.json();
      alert(data.error || "Error adding user");
    }
    setPuLoading(false);
  }

  async function handleRemovePortalUser(id: number) {
    if (!confirm("Remove this user's portal access?")) return;
    await fetch("/api/portal-users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPortalUsersList(prev => prev.filter(u => u.id !== id));
  }

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
    const link = `https://portal.bza-is.com/portal/${client.accessToken}`;
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopyLink(client)}
                          className="text-primary text-xs hover:underline"
                        >
                          {copiedId === client.id ? "Copied!" : "Copy link"}
                        </button>
                        <button
                          onClick={() => setPortalUsersClientId(portalUsersClientId === client.id ? null : client.id)}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100"
                        >
                          Users
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm border-t border-border text-right">
                    <div className="relative inline-block" ref={openDropdownId === client.id ? dropdownRef : undefined}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === client.id ? null : client.id)}
                        className="text-xs text-primary font-medium px-2 py-1 hover:bg-blue-50 rounded border border-stone-200"
                      >
                        ▼
                      </button>
                      {openDropdownId === client.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 min-w-[140px] py-1 text-left">
                          <a href={`/clients/${client.id}/send-report`} className="block w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50" onClick={() => setOpenDropdownId(null)}>Send Report</a>
                          <button onClick={() => { setOpenDropdownId(null); handleEdit(client); }} className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Edit</button>
                          <div className="border-t border-stone-100 my-1" />
                          <button onClick={() => { setOpenDropdownId(null); handleDelete(client.id); }} disabled={isPending} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
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

      {/* Portal Users Panel */}
      {portalUsersClientId && (
        <div className="bg-white rounded-md shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">
              Portal Users — {clients.find(c => c.id === portalUsersClientId)?.name}
            </h3>
            <button onClick={() => setPortalUsersClientId(null)} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {/* Existing users */}
          {portalUsersList.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">No authorized users yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {portalUsersList.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {u.lastLogin && <span className="text-[10px] text-muted-foreground">Last login: {new Date(u.lastLogin).toLocaleDateString()}</span>}
                    <button onClick={() => handleRemovePortalUser(u.id)} className="text-xs text-destructive hover:underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new user */}
          <form onSubmit={handleAddPortalUser} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Contact name"
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="email@company.com"
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <button
              type="submit"
              disabled={puLoading}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {puLoading ? "..." : "Add"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
