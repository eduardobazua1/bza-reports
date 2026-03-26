"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BotMessageSquare,
  BarChart3,
  ClipboardList,
  FileText,
  Users,
  Truck,
  Download,
  Upload,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "AI Assistant", icon: BotMessageSquare },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/shipments", label: "Shipments", icon: Truck },
  { href: "/export", label: "Export Excel", icon: Download },
  { href: "/import", label: "Import Data", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-stone-200 flex flex-col h-full">
      <div className="px-4 py-6 border-b border-stone-200 flex justify-center">
        <img src="/bza-logo-new.png" alt="BZA" className="w-52" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-stone-100 text-stone-900 font-medium"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-stone-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-600 truncate">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
