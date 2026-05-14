import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { IntelligenceWidget } from "@/components/intelligence-widget";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { SettingsDropdown } from "@/components/settings-dropdown";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <Sidebar
        userName={session.user?.name || "Usuario"}
        topBarIcons={
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <SettingsDropdown />
          </div>
        }
      />
      <main className="flex-1 overflow-auto bg-stone-100 flex flex-col">
        {/* Sticky header bar — desktop only (mobile icons live in the sidebar top bar) */}
        <div className="hidden md:flex sticky top-0 z-30 bg-stone-100/95 backdrop-blur-sm border-b border-stone-200/60 items-center justify-end px-6 h-12 shrink-0">
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <SettingsDropdown />
          </div>
        </div>
        <div className="flex-1 p-4 pt-16 md:p-6 md:pt-4 max-w-7xl mx-auto w-full">{children}</div>
      </main>
      <IntelligenceWidget />
    </div>
  );
}
