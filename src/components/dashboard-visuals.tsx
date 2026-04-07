"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Link from "next/link";

const TRANSPORT_COLORS: Record<string, string> = {
  Railroad: "#2563eb",
  Maritime: "#059669",
  Truck: "#d97706",
  Other: "#a8a29e",
};

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#059669",
  "In Transit": "#2563eb",
  Customs: "#d97706",
  Scheduled: "#a8a29e",
};

const FALLBACK_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function DashboardVisuals({
  volumeByTransport,
  volumeByStatus,
}: {
  volumeByMonth?: { month: string; tons: number }[];
  volumeByTransport: { name: string; value: number }[];
  volumeByStatus: { name: string; value: number }[];
  volumeByClient?: { name: string; value: number }[];
  volumeBySupplier?: { name: string; value: number }[];
  volumeByIncoterm?: { name: string; value: number }[];
}) {
  const chartCard = "bg-white rounded-md shadow-sm p-5 hover:shadow-md transition-shadow";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Transport Type */}
      <Link href="/reports" className={chartCard}>
        <h3 className="text-sm font-semibold text-stone-600 mb-4">Volume by Transport</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={volumeByTransport}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={PieLabel as never}
            >
              {volumeByTransport.map((d, i) => (
                <Cell key={i} fill={TRANSPORT_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 12, color: "#78716c" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </Link>

      {/* Shipment Status */}
      <Link href="/shipments" className={chartCard}>
        <h3 className="text-sm font-semibold text-stone-600 mb-4">Shipments by Status</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={volumeByStatus}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={PieLabel as never}
            >
              {volumeByStatus.map((d, i) => (
                <Cell key={i} fill={STATUS_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 12, color: "#78716c" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </Link>

    </div>
  );
}
