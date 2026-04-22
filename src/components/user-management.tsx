"use client";

import { useState, useTransition } from "react";
import { createUser, updateUser, resetPassword } from "@/server/user-actions";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export function UserManagement({ users, isAdmin }: { users: User[]; isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createUser({
        email: fd.get("email") as string,
        name: fd.get("name") as string,
        password: fd.get("password") as string,
        role: fd.get("role") as "admin" | "viewer",
      });
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: `User ${fd.get("email")} created` });
        setShowForm(false);
        router.refresh();
      }
    });
  }

  function handleToggleActive(user: User) {
    startTransition(async () => {
      await updateUser(user.id, { isActive: !user.isActive });
      router.refresh();
    });
  }

  function handleChangeRole(user: User, role: "admin" | "viewer") {
    startTransition(async () => {
      await updateUser(user.id, { role });
      router.refresh();
    });
  }

  function handleResetPassword(userId: number) {
    if (!newPassword || newPassword.length < 6) {
      setMessage({ ok: false, text: "Password must be at least 6 characters" });
      return;
    }
    startTransition(async () => {
      await resetPassword(userId, newPassword);
      setMessage({ ok: true, text: "Password updated" });
      setResetUserId(null);
      setNewPassword("");
    });
  }

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-md shadow-sm p-8 text-center text-muted-foreground">
        Only admins can manage users.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.ok ? "bg-green-50 text-[#0d9488] border border-green-200" : "bg-[#0d3d3b] text-[#0d3d3b] border border-[#0d3d3b]"}`}>
          {message.text}
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          + New User
        </button>
      ) : (
        <div className="bg-white rounded-md shadow-sm p-4">
          <h3 className="font-semibold mb-4">Create User</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input name="name" required placeholder="Eduardo Bazua" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input name="email" type="email" required placeholder="email@bza-is.com" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input name="password" type="password" required minLength={6} placeholder="Minimum 6 characters" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role *</label>
              <select name="role" required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="admin">Admin — Full access</option>
                <option value="viewer">Viewer — Read only</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {isPending ? "Creating..." : "Create User"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-border px-4 py-2 rounded-lg text-sm hover:bg-muted">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-md shadow-sm">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Users</h3>
        </div>
        <div className="divide-y divide-border">
          {users.map((user) => (
            <div key={user.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {user.role}
                    </span>
                    {!user.isActive && <span className="text-xs bg-[#0d3d3b] text-[#0d3d3b] px-2 py-0.5 rounded">Inactive</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={isPending}
                    className={`text-xs px-2 py-1 rounded ${user.isActive ? "text-[#0d9488] hover:bg-[#0d9488]" : "text-[#0d9488] hover:bg-green-50"}`}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeRole(user, e.target.value as "admin" | "viewer")}
                    disabled={isPending}
                    className="text-xs border border-border rounded px-1 py-0.5 bg-background"
                  >
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => setResetUserId(resetUserId === user.id ? null : user.id)}
                    className="text-xs text-primary hover:underline"
                  >
                    Change Password
                  </button>
                </div>
              </div>

              {resetUserId === user.id && (
                <div className="flex gap-2 items-center ml-4">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    minLength={6}
                    className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background w-48"
                  />
                  <button
                    onClick={() => handleResetPassword(user.id)}
                    disabled={isPending}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setResetUserId(null); setNewPassword(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
