"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  CreditCard,
  Clock,
  Truck,
  Send,
  FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type NotificationSeverity = "critical" | "warning" | "info";
type NotificationType =
  | "overdue"
  | "due_soon"
  | "stale_shipment"
  | "pending_report"
  | "proposal_expiring";

type AppNotification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  link: string;
  date: string | null;
};

// ── localStorage helpers ──────────────────────────────────────────────────────
const DISMISSED_KEY = "bza_dismissed_notifs";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(set: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch {}
}

// After a fetch, prune IDs that no longer exist in the server response
// (those notifications resolved naturally — no need to keep them dismissed)
function pruneStale(dismissed: Set<string>, allIds: string[]): Set<string> {
  const live = new Set(allIds);
  const pruned = new Set([...dismissed].filter(id => live.has(id)));
  return pruned;
}

// ── Config ───────────────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-50 border-red-200",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-400",
    badge: "bg-blue-100 text-blue-700",
  },
};

const TYPE_CONFIG: Record<NotificationType, { label: string; Icon: React.ElementType }> = {
  overdue:           { label: "Overdue",          Icon: CreditCard },
  due_soon:          { label: "Due Soon",          Icon: Clock },
  stale_shipment:    { label: "Stale Shipment",    Icon: Truck },
  pending_report:    { label: "Pending Report",    Icon: Send },
  proposal_expiring: { label: "Proposal Expiring", Icon: FileText },
};

// ── Individual card ───────────────────────────────────────────────────────────
function NotifCard({
  n,
  onDismiss,
  onClosePanel,
}: {
  n: AppNotification;
  onDismiss: (id: string) => void;
  onClosePanel: () => void;
}) {
  const s = SEVERITY_CONFIG[n.severity];
  const t = TYPE_CONFIG[n.type];
  const TypeIcon = t.Icon;

  return (
    <div className={`flex items-stretch rounded-lg border ${s.bg} overflow-hidden`}>
      {/* Clickable link area */}
      <Link
        href={n.link}
        onClick={() => { onDismiss(n.id); onClosePanel(); }}
        className="flex items-start gap-2.5 p-3 flex-1 hover:brightness-95 transition-all min-w-0"
      >
        <div className={`mt-0.5 shrink-0 ${s.iconColor}`}>
          <TypeIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-stone-800 leading-snug">{n.title}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.badge}`}>
              {t.label}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{n.description}</p>
          {n.date && (
            <p className="text-[10px] text-stone-400 mt-0.5">
              {new Date(n.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          )}
        </div>
      </Link>

      {/* Dismiss-only button (doesn't navigate) */}
      <button
        onClick={() => onDismiss(n.id)}
        title="Dismiss"
        className="px-2 flex items-start pt-3 text-stone-300 hover:text-stone-500 transition-colors shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Dropdown panel ────────────────────────────────────────────────────────────
function DropdownPanel({
  notifications,
  anchorRect,
  onClose,
  onDismiss,
  onDismissAll,
}: {
  notifications: AppNotification[];
  anchorRect: DOMRect;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
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

  const PANEL_W = 340;
  const GAP = 8;
  let left = anchorRect.right - PANEL_W;
  if (left < 8) left = 8;
  const top = anchorRect.bottom + GAP;

  const critical = notifications.filter(n => n.severity === "critical");
  const warning  = notifications.filter(n => n.severity === "warning");
  const info     = notifications.filter(n => n.severity === "info");

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top, left, width: PANEL_W, zIndex: 99998 }}
      className="bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#0d3d3b] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-white/80" />
          <span className="text-sm font-semibold text-white">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full">
              {notifications.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onDismissAll}
              className="text-[10px] text-white/60 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary badges */}
      {notifications.length > 0 && (
        <div className="px-3 py-2 flex items-center gap-1.5 border-b border-stone-100 flex-wrap">
          {critical.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-2.5 h-2.5" />
              {critical.length} critical
            </span>
          )}
          {warning.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" />
              {warning.length} warnings
            </span>
          )}
          {info.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              <Info className="w-2.5 h-2.5" />
              {info.length} info
            </span>
          )}
        </div>
      )}

      {/* Scrollable list */}
      <div className="overflow-y-auto max-h-[420px] p-3 space-y-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-semibold text-stone-700">All clear!</p>
            <p className="text-xs text-stone-400">No pending alerts.</p>
          </div>
        ) : (
          <>
            {critical.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest px-1">Critical</p>
                {critical.map(n => (
                  <NotifCard key={n.id} n={n} onDismiss={onDismiss} onClosePanel={onClose} />
                ))}
              </div>
            )}
            {warning.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest px-1">Warnings</p>
                {warning.map(n => (
                  <NotifCard key={n.id} n={n} onDismiss={onDismiss} onClosePanel={onClose} />
                ))}
              </div>
            )}
            {info.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest px-1">Info</p>
                {info.map(n => (
                  <NotifCard key={n.id} n={n} onDismiss={onDismiss} onClosePanel={onClose} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-stone-100 shrink-0">
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          View full notifications page →
        </Link>
      </div>
    </div>,
    document.body
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function NotificationsDropdown() {
  const pathname = usePathname();
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Load dismissed IDs from localStorage on mount
  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data: AppNotification[] = await res.json();
      if (!Array.isArray(data)) return;
      setAllNotifications(data);
      // Prune dismissed IDs that no longer exist server-side
      setDismissed(prev => {
        const pruned = pruneStale(prev, data.map(n => n.id));
        saveDismissed(pruned);
        return pruned;
      });
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => { fetchNotifications(); }, [pathname, fetchNotifications]);

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set([...prev, id]);
      saveDismissed(next);
      return next;
    });
  }

  function dismissAll() {
    const allIds = new Set(allNotifications.map(n => n.id));
    setDismissed(allIds);
    saveDismissed(allIds);
  }

  function toggle() {
    if (open) {
      setOpen(false);
      setAnchorRect(null);
    } else {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) { setAnchorRect(rect); setOpen(true); }
    }
  }

  // Only show non-dismissed notifications
  const visible = allNotifications.filter(n => !dismissed.has(n.id));
  const count = visible.length;
  const hasCritical = visible.some(n => n.severity === "critical");

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Notifications"
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm border ${
          open
            ? "bg-[#0a5c5a] border-[#0a5c5a] text-white"
            : "bg-white border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
        }`}
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {count > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none ${
              hasCritical ? "bg-red-500" : "bg-amber-500"
            }`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && anchorRect && (
        <DropdownPanel
          notifications={visible}
          anchorRect={anchorRect}
          onClose={() => { setOpen(false); setAnchorRect(null); }}
          onDismiss={dismiss}
          onDismissAll={dismissAll}
        />
      )}
    </>
  );
}
