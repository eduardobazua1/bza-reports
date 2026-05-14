import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { IntelligenceWidget } from "@/components/intelligence-widget";
import { NotificationsDropdown } from "@/components/notifications-dropdown";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <Sidebar userName={session.user?.name || "Usuario"} />
      <main className="flex-1 overflow-auto bg-stone-100">
        {/* Notifications bell — top-right corner */}
        <div className="fixed top-4 right-20 z-50 md:top-5 md:right-20">
          <NotificationsDropdown />
        </div>
        <div className="p-4 pt-16 md:p-6 md:pt-6 max-w-7xl mx-auto">{children}</div>
      </main>
      <IntelligenceWidget />
    </div>
  );
}
