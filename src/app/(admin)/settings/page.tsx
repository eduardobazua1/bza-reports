import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { UserManagement } from "@/components/user-management";

export default async function SettingsPage() {
  const session = await auth();
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
  }).from(users);

  const currentUserRole = (session?.user as { role?: string })?.role;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <UserManagement users={allUsers} isAdmin={currentUserRole === "admin"} />
    </div>
  );
}
