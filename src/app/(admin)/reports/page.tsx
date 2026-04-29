"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, ChevronDown } from "lucide-react";

const REPORT_CATEGORIES = [
  {
    id: "business-overview",
    label: "Business Overview",
    reports: [
      { id: "balance-sheet",   label: "Balance Sheet",     href: "/reports/balance-sheet",   ready: false },
      { id: "pl-by-customer",  label: "P&L by Customer",   href: "/reports/pl-by-customer",  ready: true  },
      { id: "pl-by-month",     label: "P&L by Month",      href: "/reports/pl-by-month",     ready: true  },
    ],
  },
  {
    id: "who-owes-you",
    label: "Who Owes You",
    reports: [
      { id: "ar-aging-summary",  label: "A/R Aging Summary",       href: "/reports/ar-aging-summary",  ready: true  },
      { id: "ar-aging-detail",   label: "A/R Aging Detail",        href: "/reports/ar-aging-detail",   ready: true  },
      { id: "open-invoices",     label: "Open Invoices",           href: "/reports/open-invoices",     ready: true  },
      { id: "invoice-list",      label: "Invoice List",            href: "/reports/invoice-list",      ready: true  },
      { id: "received-payments", label: "Received Payments",       href: "/reports/received-payments", ready: true  },
      { id: "statements",        label: "Statements",              href: "/reports/statements",        ready: true  },
    ],
  },
  {
    id: "sales-customers",
    label: "Sales & Customers",
    reports: [
      { id: "customer-contacts",    label: "Customer Contact List",   href: "/reports/customer-contacts",    ready: true  },
      { id: "income-by-customer",   label: "Income by Customer",      href: "/reports/income-by-customer",   ready: true  },
      { id: "product-service-list", label: "Product & Service List",  href: "/reports/product-service-list", ready: false },
      { id: "sales-by-product",     label: "Sales by Product",        href: "/reports/sales-by-product",     ready: false },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    reports: [
      { id: "open-pos-by-customer", label: "Open POs by Customer",        href: "/reports/open-pos-by-customer", ready: true  },
      { id: "open-pos-by-product",  label: "Open POs by Product",         href: "/reports/open-pos-by-product",  ready: false },
    ],
  },
  {
    id: "what-you-owe",
    label: "What You Owe",
    reports: [
      { id: "ap-aging-summary",       label: "A/P Aging Summary",       href: "/reports/ap-aging-summary",       ready: false },
      { id: "ap-aging-detail",        label: "A/P Aging Detail",        href: "/reports/ap-aging-detail",        ready: false },
      { id: "vendor-balance-summary", label: "Vendor Balance Summary",  href: "/reports/vendor-balance-summary", ready: false },
      { id: "vendor-balance-detail",  label: "Vendor Balance Detail",   href: "/reports/vendor-balance-detail",  ready: false },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    reports: [
      { id: "vendor-contacts", label: "Vendor Contact List",  href: "/reports/vendor-contacts", ready: true  },
      { id: "pos-by-vendor",   label: "POs by Vendor",        href: "/reports/pos-by-vendor",   ready: true  },
    ],
  },
];

const FAV_KEY = "bza_fav_reports";

export default function ReportsHubPage() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch {}
  }, []);

  function toggleFav(id: string) {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleCollapsed(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const allReports = REPORT_CATEGORIES.flatMap(c => c.reports);
  const favoriteReports = allReports.filter(r => favorites.includes(r.id));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Standard Reports</h1>
      </div>

      {/* Favorites */}
      {favoriteReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-semibold text-stone-700">Favorites</span>
          </div>
          <div className="divide-y divide-stone-50">
            {favoriteReports.map(r => (
              <ReportRow key={r.id} report={r} isFav={true} onToggleFav={() => toggleFav(r.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Custom Reports */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Custom Reports</span>
          <Link href="/custom-reports" className="text-xs text-[#0d9488] hover:underline font-medium">
            + Create new report
          </Link>
        </div>
        <div className="px-5 py-4 text-sm text-stone-400 italic">
          No custom reports yet. Create one from any standard report.
        </div>
      </div>

      {/* Categories */}
      {REPORT_CATEGORIES.map(cat => {
        const open = !collapsed[cat.id];
        return (
          <div key={cat.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleCollapsed(cat.id)}
              className="w-full px-5 py-3.5 border-b border-stone-100 flex items-center justify-between hover:bg-stone-50 transition-colors"
            >
              <span className="text-sm font-semibold text-stone-800">{cat.label}</span>
              <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-0">
                {cat.reports.map(r => (
                  <ReportRow key={r.id} report={r} isFav={favorites.includes(r.id)} onToggleFav={() => toggleFav(r.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportRow({
  report,
  isFav,
  onToggleFav,
}: {
  report: { id: string; label: string; href: string; ready: boolean };
  isFav: boolean;
  onToggleFav: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 hover:bg-stone-50 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Link href={report.href} className="text-sm text-stone-700 hover:text-[#0d9488] hover:underline truncate">
          {report.label}
        </Link>
        {!report.ready && (
          <span className="text-[10px] text-stone-300 italic shrink-0">coming soon</span>
        )}
      </div>
      <button onClick={onToggleFav} className="ml-3 shrink-0 text-stone-300 hover:text-amber-400 transition-colors">
        <Star className={`w-4 h-4 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>
    </div>
  );
}
