"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Turn a pathname into a readable label, e.g. "/purchase-orders" -> "Purchase Orders",
// "/invoices/42" -> "Invoices · 42".
function prettyPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return "Home";
  return parts
    .map((p) => (/^\d+$/.test(p) ? p : p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())))
    .join(" · ");
}

// Logs every page the current user opens (fire-and-forget). Mounted app-wide.
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    if (pathname === "/activity") return; // don't log viewing the log itself
    try {
      fetch("/api/activity/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname, label: prettyPath(pathname) }),
        keepalive: true,
      }).catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }, [pathname]);

  return null;
}
