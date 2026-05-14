import { getNotifications, AppNotification } from "@/lib/get-notifications";
import Link from "next/link";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  FileText,
  Truck,
  Clock,
  Send,
  CreditCard,
} from "lucide-react";

export const dynamic = "force-dynamic";

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-[#0d3d3b]/10 border-[#0d3d3b]/25",
    iconColor: "text-[#0d3d3b]",
    badge: "bg-[#0d3d3b] text-white",
  },
  warning: {
    bg: "bg-[#0d3d3b]/[0.05] border-[#0a5c5a]/20",
    iconColor: "text-[#0a5c5a]",
    badge: "bg-[#0a5c5a]/15 text-[#0a5c5a]",
  },
  info: {
    bg: "bg-stone-50 border-stone-200",
    iconColor: "text-stone-400",
    badge: "bg-stone-100 text-stone-500",
  },
};

const TYPE_CONFIG: Record<string, { label: string; Icon: React.ElementType }> = {
  overdue:           { label: "Overdue Invoice",     Icon: CreditCard },
  due_soon:          { label: "Due Soon",            Icon: Clock },
  stale_shipment:    { label: "Stale Shipment",      Icon: Truck },
  pending_report:    { label: "Pending Report",      Icon: Send },
  proposal_expiring: { label: "Proposal Expiring",   Icon: FileText },
};

function NotificationCard({ n }: { n: AppNotification }) {
  const s = SEVERITY_CONFIG[n.severity];
  const t = TYPE_CONFIG[n.type] ?? { label: n.type, Icon: Info };
  const TypeIcon = t.Icon;

  return (
    <Link
      href={n.link}
      className={`flex items-start gap-3 p-4 rounded-xl border ${s.bg} hover:brightness-95 transition-all group`}
    >
      <div className={`mt-0.5 shrink-0 ${s.iconColor}`}>
        <TypeIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-stone-800 leading-snug">{n.title}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.badge}`}>
            {t.label}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{n.description}</p>
        {n.date && (
          <p className="text-[11px] text-stone-400 mt-1">
            {n.type === "overdue" ? "Was due" : n.type === "stale_shipment" ? "Last update" : "Date"}:{" "}
            {new Date(n.date + "T12:00:00").toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function NotificationsPage() {
  const all = await getNotifications();

  const critical = all.filter(n => n.severity === "critical");
  const warning  = all.filter(n => n.severity === "warning");
  const info     = all.filter(n => n.severity === "info");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Notifications</h1>
          <p className="text-sm text-stone-500 mt-1">
            Alerts, reminders, and items that need attention
          </p>
          <div className="mt-3">
            <PushSubscribeButton />
          </div>
        </div>
        {all.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            {critical.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#0d3d3b] text-white px-2.5 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                {critical.length} critical
              </span>
            )}
            {warning.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#0a5c5a]/15 text-[#0a5c5a] px-2.5 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {warning.length} warnings
              </span>
            )}
            {info.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full">
                <Info className="w-3 h-3" />
                {info.length} info
              </span>
            )}
          </div>
        )}
      </div>

      {/* All clear */}
      {all.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-[#0d3d3b]/30" />
          <p className="text-lg font-semibold text-stone-700">All clear!</p>
          <p className="text-sm text-stone-400">No alerts or pending items right now.</p>
        </div>
      )}

      {/* Critical */}
      {critical.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#0d3d3b]" />
            <h2 className="text-sm font-bold text-[#0d3d3b] uppercase tracking-wide">Critical</h2>
            <span className="text-xs bg-[#0d3d3b] text-white font-semibold px-2 py-0.5 rounded-full">{critical.length}</span>
          </div>
          <div className="space-y-2">
            {critical.map(n => <NotificationCard key={n.id} n={n} />)}
          </div>
        </section>
      )}

      {/* Warnings */}
      {warning.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#0a5c5a]" />
            <h2 className="text-sm font-bold text-[#0a5c5a] uppercase tracking-wide">Warnings</h2>
            <span className="text-xs bg-[#0a5c5a]/15 text-[#0a5c5a] font-semibold px-2 py-0.5 rounded-full">{warning.length}</span>
          </div>
          <div className="space-y-2">
            {warning.map(n => <NotificationCard key={n.id} n={n} />)}
          </div>
        </section>
      )}

      {/* Info */}
      {info.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-stone-400" />
            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wide">Info</h2>
            <span className="text-xs bg-stone-100 text-stone-500 font-semibold px-2 py-0.5 rounded-full">{info.length}</span>
          </div>
          <div className="space-y-2">
            {info.map(n => <NotificationCard key={n.id} n={n} />)}
          </div>
        </section>
      )}
    </div>
  );
}
