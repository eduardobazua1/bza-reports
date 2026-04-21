"use client";

import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatNumber, formatDate, shipmentStatusLabels, shipmentStatusColors } from "@/lib/utils";

type RecentShipment = {
  invoiceNumber: string;
  clientName: string;
  destination: string;
  tons: number;
  shipmentDate: string | null;
  status: string;
};

type MonthVolume = { month: string; tons: number; revenue?: number; cost?: number; profit?: number };

export function DashboardVisuals({
  recentShipments,
  volumeByMonth = [],
}: {
  recentShipments: RecentShipment[];
  volumeByMonth?: MonthVolume[];
  volumeByTransport?: unknown[];
  volumeByStatus?: unknown[];
  volumeByClient?: unknown[];
  volumeBySupplier?: unknown[];
  volumeByIncoterm?: unknown[];
}) {
  return (
    <div className="space-y-4">
      {/* Monthly Volume Chart + Breakdown */}
      {volumeByMonth.length > 0 && (
        <div className="bg-white rounded-md shadow-sm">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-700">Monthly Volume (TN)</h3>
              <Link href="/reports/monthly" className="text-xs text-[#0d3d3b] font-medium hover:underline">View breakdown →</Link>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeByMonth} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d3d3b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0d3d3b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} tick={{ fill: "#a8a29e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v) => [`${formatNumber(Number(v), 0)} TN`, "Volume"]}
                    contentStyle={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, fontSize: 11 }}
                    cursor={{ stroke: "#e7e5e4" }}
                  />
                  <Area type="monotone" dataKey="tons" stroke="#0d3d3b" strokeWidth={2} fill="url(#volGradient)" dot={false} activeDot={{ r: 4, fill: "#0d3d3b" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Recent Shipments Table */}
      <div className="bg-white rounded-md shadow-sm">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Recent Shipments</h3>
          <Link href="/invoices" className="text-xs text-[#0d3d3b] font-medium hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Invoice</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide hidden sm:table-cell">Destination</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Tons</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentShipments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400 text-sm">No shipments found</td>
                </tr>
              )}
              {recentShipments.map((s, i) => {
                const label = shipmentStatusLabels[s.status] ?? "Scheduled";
                const cls = shipmentStatusColors[s.status] ?? "bg-stone-100 text-stone-600";
                return (
                  <tr key={i} className="border-t border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[#0d3d3b] text-xs">{s.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-stone-700 text-xs max-w-[100px] truncate">{s.clientName || "—"}</td>
                    <td className="px-4 py-2.5 text-stone-500 text-xs hidden sm:table-cell">{s.destination || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-stone-800 text-xs">{formatNumber(s.tons, 0)}</td>
                    <td className="px-4 py-2.5 text-stone-400 text-xs hidden sm:table-cell">{formatDate(s.shipmentDate)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
