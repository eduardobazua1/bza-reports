"use client";

import { useState } from "react";
import { BzaLogo } from "./bza-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  FileText,
  Users,
  Truck,
  Package,
  Download,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  Ship,
  Database,
  HelpCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; icon: LucideIcon; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

const navEntries: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/products", label: "Products", icon: Package },
  {
    label: "Reports",
    icon: BarChart3,
    children: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/shipments", label: "Shipments", icon: Ship },
      { href: "/market-prices", label: "Market Prices", icon: TrendingUp },
    ],
  },
  {
    label: "Data",
    icon: Database,
    children: [
      { href: "/import", label: "Import Data", icon: Upload },
      { href: "/export", label: "Export Excel", icon: Download },
    ],
  },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help & Support", icon: HelpCircle },
];

function NavGroupItem({ group, pathname, onNav }: { group: NavGroup; pathname: string; onNav: () => void }) {
  const isChildActive = group.children.some(
    c => pathname === c.href || pathname.startsWith(c.href + "/")
  );
  const [open, setOpen] = useState(isChildActive);
  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isChildActive
            ? "bg-stone-100 text-stone-900 font-medium"
            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-stone-100 pl-3">
          {group.children.map(child => {
            const isActive = pathname === child.href || pathname.startsWith(child.href + "/");
            const CIcon = child.icon;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNav}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                }`}
              >
                <CIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navContent = (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navEntries.map((entry, i) => {
          if (isGroup(entry)) {
            return (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
                onNav={() => setOpen(false)}
              />
            );
          }
          const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-stone-100 text-stone-900 font-medium"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {entry.label}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <BzaLogo size="md" />
        <button onClick={() => setOpen(!open)} className="text-stone-600">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed top-0 left-0 z-40 w-72 h-full bg-white border-r border-stone-200 flex flex-col transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-4 py-4 border-b border-stone-200 flex items-center justify-between">
          <BzaLogo size="md" />
          <button onClick={() => setOpen(false)} className="text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-stone-200 flex-col h-full">
        <div className="px-4 py-6 border-b border-stone-200 flex justify-center">
          <BzaLogo size="md" />
        </div>
        {navContent}
      </aside>
    </>
  );
}
