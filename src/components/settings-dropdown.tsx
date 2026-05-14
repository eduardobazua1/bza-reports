"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Settings,
  X,
  Database,
  HelpCircle,
  UserCog,
  ChevronRight,
} from "lucide-react";
import { usePathname } from "next/navigation";

const MENU_ITEMS = [
  {
    href: "/settings",
    label: "Settings",
    description: "Account, preferences & integrations",
    Icon: Settings,
  },
  {
    href: "/import",
    label: "Data",
    description: "Import & export data",
    Icon: Database,
  },
  {
    href: "/portal-users",
    label: "Portal Users",
    description: "Manage client portal access",
    Icon: UserCog,
  },
  {
    href: "/help",
    label: "Help & Support",
    description: "Docs, guides and contact",
    Icon: HelpCircle,
  },
];

function DropdownPanel({
  anchorRect,
  onClose,
  pathname,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  pathname: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const PANEL_W = 280;
  const GAP = 8;
  let left = anchorRect.right - PANEL_W;
  if (left < 8) left = 8;
  const top = anchorRect.bottom + GAP;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top, left, width: PANEL_W, zIndex: 99998 }}
      className="bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#0d3d3b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-white/80" />
          <span className="text-sm font-semibold text-white">Settings & Tools</span>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Menu items */}
      <div className="p-2">
        {MENU_ITEMS.map(({ href, label, description, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                isActive ? "bg-stone-100" : "hover:bg-stone-50"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isActive ? "bg-[#0d3d3b] text-white" : "bg-stone-100 text-stone-500 group-hover:bg-stone-200"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${isActive ? "text-stone-900" : "text-stone-700"}`}>
                  {label}
                </p>
                <p className="text-[11px] text-stone-400 leading-tight mt-0.5">{description}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

export function SettingsDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = MENU_ITEMS.some(
    item => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  function toggle() {
    if (open) {
      setOpen(false);
      setAnchorRect(null);
    } else {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) { setAnchorRect(rect); setOpen(true); }
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Settings & Tools"
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm border ${
          open || isActive
            ? "bg-[#0a5c5a] border-[#0a5c5a] text-white"
            : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
        }`}
      >
        <Settings className="w-4 h-4" strokeWidth={1.75} />
      </button>

      {open && anchorRect && (
        <DropdownPanel
          anchorRect={anchorRect}
          onClose={() => { setOpen(false); setAnchorRect(null); }}
          pathname={pathname}
        />
      )}
    </>
  );
}
