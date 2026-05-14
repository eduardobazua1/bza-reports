"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  LogOut,
  Menu,
  X,
  ChevronDown,
  CreditCard,
  Plus,
  ShoppingCart,
  Wallet,
  ScrollText,
  Send,
  FileMinus,
  type LucideIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type NavLeaf     = { href: string; label: string; icon?: LucideIcon };
type NavSection  = { section: string; children: NavLeaf[] };
type NavGroup    = { label: string; icon: LucideIcon; children: (NavLeaf | NavSection)[] };
type RootEntry   = (NavLeaf & { icon: LucideIcon }) | NavGroup;

function isGroup(e: RootEntry): e is NavGroup   { return "children" in e; }
function isSection(e: NavLeaf | NavSection): e is NavSection { return "section" in e; }

// ── Quick Create ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    group: "Operations",
    items: [
      { label: "New Proposal",             href: "/proposals/new",      description: "Send a price proposal to a client" },
      { label: "New Purchase Order",       href: "/purchase-orders",    description: "Create a new PO" },
      { label: "New Invoice / Shipment",   href: "/invoices",           description: "Add shipment to a PO" },
    ],
  },
  {
    group: "Payments",
    items: [
      { label: "Record Customer Payment",  href: "/payments",                description: "Mark invoices as paid" },
      { label: "Record Supplier Payment",  href: "/payments?tab=supplier",   description: "Log payment to supplier" },
    ],
  },
  {
    group: "Contacts",
    items: [
      { label: "Add Client",    href: "/clients",    description: "Register a new client" },
      { label: "Add Supplier",  href: "/suppliers",  description: "Register a new supplier" },
    ],
  },
];

function QuickCreateDropdown({
  anchorRect,
  onClose,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // slight delay so the opening click doesn't immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Position below the button, left-aligned, but clamp to viewport
  const GAP = 6;
  const MENU_W = 272;
  let left = anchorRect.left;
  if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8;
  const top = anchorRect.bottom + GAP;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top, left, width: MENU_W, zIndex: 99999 }}
      className="bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden"
    >
      <div className="px-4 py-2.5 bg-[#0d3d3b] flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Quick Create</span>
        <button onClick={onClose} className="text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      {QUICK_ACTIONS.map(section => (
        <div key={section.group}>
          <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            {section.group}
          </p>
          {section.items.map(item => (
            <Link key={item.href + item.label} href={item.href} onClick={onClose}
              className="flex flex-col px-4 py-2.5 hover:bg-stone-50 transition-colors">
              <span className="text-sm font-medium text-stone-800">{item.label}</span>
              <span className="text-xs text-stone-400">{item.description}</span>
            </Link>
          ))}
        </div>
      ))}
      <div className="h-2" />
    </div>,
    document.body
  );
}

// ── Nav structure ────────────────────────────────────────────────────────────
const mainEntries: RootEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Customer Hub", icon: Users,
    children: [
      { href: "/clients",    label: "Clients" },
      { href: "/contracts",  label: "Contracts" },
      { href: "/proposals",  label: "Proposals" },
    ],
  },
  {
    label: "Sales", icon: ShoppingCart,
    children: [
      { href: "/purchase-orders", label: "Purchase Orders" },
      { href: "/invoices",        label: "Invoices" },
      { href: "/payments",        label: "Payments (A/R)" },
      { href: "/products",        label: "Products & Services" },
      { href: "/credit-memos",    label: "Credit Memo" },
    ],
  },
  {
    label: "Expenses", icon: Wallet,
    children: [
      { href: "/suppliers",              label: "Vendors" },
      { href: "/payments?tab=supplier",  label: "Payments (A/P)" },
      { href: "/supplier-orders",        label: "Purchase Orders" },
    ],
  },
  {
    label: "Reports", icon: BarChart3,
    children: [
      { href: "/reports",        label: "Standard Reports" },
      { href: "/custom-reports", label: "Custom Reports"   },
    ],
  },
];


// ── NavGroupItem ─────────────────────────────────────────────────────────────
function NavGroupItem({ group, pathname, onNav }: { group: NavGroup; pathname: string; onNav: () => void }) {
  const allLeaves = group.children.flatMap(c => isSection(c) ? c.children : [c]);
  const isChildActive = allLeaves.some(
    c => pathname === c.href || pathname.startsWith(c.href.split("?")[0] + "/")
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
        <div className="ml-3 mt-0.5 border-l border-stone-100 pl-3 space-y-0.5">
          {group.children.map((child, i) => {
            if (isSection(child)) {
              return (
                <div key={child.section}>
                  <p className="px-2 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                    {child.section}
                  </p>
                  {child.children.map(leaf => {
                    const isActive = pathname === leaf.href || pathname.startsWith(leaf.href.split("?")[0] + "/");
                    return (
                      <Link key={leaf.href} href={leaf.href} onClick={onNav}
                        className={`flex items-center px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isActive
                            ? "bg-stone-100 text-stone-900 font-medium"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                        }`}
                      >
                        {leaf.label}
                      </Link>
                    );
                  })}
                </div>
              );
            }
            const isActive = pathname === child.href || pathname.startsWith(child.href.split("?")[0] + "/");
            return (
              <Link key={child.href} href={child.href} onClick={onNav}
                className={`flex items-center px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnDesktopRef = useRef<HTMLButtonElement>(null);
  const btnMobileRef  = useRef<HTMLButtonElement>(null);

  function toggleQuick(ref: React.RefObject<HTMLButtonElement>) {
    if (quickOpen) {
      setQuickOpen(false);
      setAnchorRect(null);
    } else {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) { setAnchorRect(rect); setQuickOpen(true); }
    }
  }

  function renderMain(onNav: () => void) {
    return mainEntries.map((entry) => {
      if (isGroup(entry)) {
        return <NavGroupItem key={entry.label} group={entry} pathname={pathname} onNav={onNav} />;
      }
      const isActive = pathname === entry.href || pathname.startsWith(entry.href + "/");
      const Icon = entry.icon;
      return (
        <Link key={entry.href} href={entry.href} onClick={onNav}
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
    });
  }

  const navContent = (onNav: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {renderMain(onNav)}
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
      {/* Portal dropdown — rendered at body level, always on top */}
      {quickOpen && anchorRect && (
        <QuickCreateDropdown
          anchorRect={anchorRect}
          onClose={() => { setQuickOpen(false); setAnchorRect(null); }}
        />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <BzaLogo size="md" />
        <button onClick={() => setOpen(!open)} className="text-stone-600">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed top-0 left-0 z-40 w-72 h-full bg-white border-r border-stone-200 flex flex-col transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo box */}
        <div className="px-4 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <BzaLogo size="md" />
          <button onClick={() => { setOpen(false); setQuickOpen(false); }} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* + button row */}
        <div className="px-4 py-2.5 flex justify-center border-b border-stone-100 shrink-0">
          <button
            ref={btnMobileRef}
            onClick={() => toggleQuick(btnMobileRef)}
            className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition-colors shadow-sm ${quickOpen ? "bg-[#0a5c5a]" : "bg-[#0d3d3b] hover:bg-[#0a5c5a]"}`}
            title="Quick create"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
        {navContent(() => { setOpen(false); setQuickOpen(false); })}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-stone-200 flex-col h-full">
        {/* Logo box */}
        <div className="px-4 py-6 border-b border-stone-200 flex justify-center shrink-0">
          <BzaLogo size="md" />
        </div>
        {/* + button row — below logo, above Dashboard */}
        <div className="px-4 py-3 flex justify-center border-b border-stone-100 shrink-0">
          <button
            ref={btnDesktopRef}
            onClick={() => toggleQuick(btnDesktopRef)}
            className={`w-9 h-9 rounded-full text-white flex items-center justify-center transition-colors shadow-sm ${quickOpen ? "bg-[#0a5c5a]" : "bg-[#0d3d3b] hover:bg-[#0a5c5a]"}`}
            title="Quick create"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        {navContent(() => setQuickOpen(false))}
      </aside>
    </>
  );
}
