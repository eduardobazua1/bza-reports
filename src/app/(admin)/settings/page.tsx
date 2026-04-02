import { db } from "@/db";
import { users, appSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { UserManagement } from "@/components/user-management";
import { InvoiceTemplateEditor } from "@/components/invoice-template-editor";

export default async function SettingsPage() {
  const session = await auth();
  const [allUsers, invoiceSettingsRow] = await Promise.all([
    db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, "invoice") }),
  ]);

  const currentUserRole = (session?.user as { role?: string })?.role;
  let invoiceSettings = null;
  try { invoiceSettings = invoiceSettingsRow ? JSON.parse(invoiceSettingsRow.value) : null; } catch { /* use null */ }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <InvoiceTemplateEditor initial={invoiceSettings} />
      <UserManagement users={allUsers} isAdmin={currentUserRole === "admin"} />
    </div>
  );
}
