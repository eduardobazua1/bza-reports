"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

export function NotificationsBell() {
  const pathname = usePathname();
  const isActive = pathname === "/notifications";
  const [count, setCount] = useState<number | null>(null);

  async function fetchCount() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // silently fail — don't break the nav
    }
  }

  useEffect(() => {
    fetchCount();
    // Refresh every 5 minutes
    const id = setInterval(fetchCount, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Also refresh when navigating back to non-notifications pages
  useEffect(() => {
    if (pathname !== "/notifications") fetchCount();
  }, [pathname]);

  const critical = count !== null && count > 0;

  return (
    <Link
      href="/notifications"
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
        isActive
          ? "bg-stone-100 text-stone-900 font-medium"
          : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
      }`}
    >
      <span className="relative shrink-0">
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {critical && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {count! > 99 ? "99+" : count}
          </span>
        )}
      </span>
      Notifications
    </Link>
  );
}
