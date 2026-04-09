"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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
  volumeByMonth,
  volumeByTransport,
  volumeByStatus,
}: {
  volumeByMonth: { month: string; tons: number }[];
  volumeByTransport: { name: string; value: number }[];
  volumeByStatus: { name: string; value: number }[];
  volumeByClient?: { name: string; value: number }[];
  volumeBySupplier?: { name: string; value: number }[];
  volumeByIncoterm?: { name: string; value: number }[];
}) {
  const chartCard = "bg-white rounded-md shadow-sm p-5 hover:shadow-md transition-shadow";

  const volNums = volumeByMonth.map(d => d.tons);
  const volMin = volNums.length ? Math.min(...volNums) : 0;
  const volMax = volNums.length ? Math.max(...volNums) : 1000;
  const yMin = Math.max(0, Math.floor(volMin * 0.85 / 200) * 200);
  const yMax = Math.ceil(volMax * 1.05 / 200) * 200;

  return (
    <div className="space-y-4">

      {/* Volume by Month — area chart */}
      <Link href="/reports" className={chartCard}>
        <h3 className="text-sm font-semibold text-stone-600 mb-2">Volume by Month (TN)</h3>
        <div className="h-[160px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={volumeByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
            <defs>
              <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d3d3b" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#0d3d3b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0efed" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "#a8a29e" }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#a8a29e" }}
              axisLine={false} tickLine={false} width={42}
              tickCount={4}
              domain={[yMin, yMax]}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", fontSize: 13 }}
              formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]}
              cursor={{ stroke: "#0d3d3b", strokeWidth: 1, strokeDasharray: "4 2" }}
            />
            <Area
              type="monotone" dataKey="tons"
              stroke="#0d3d3b" strokeWidth={2.5}
              fill="url(#volGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "#4dd9b4", strokeWidth: 0 }}
              isAnimationActive={false}
              baseValue={yMin}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Transport Type */}
      <Link href="/reports" className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-shadow">
        <h3 className="text-xs font-semibold text-stone-500 mb-1">Volume by Transport</h3>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={volumeByTransport} cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel as never}>
                {volumeByTransport.map((d, i) => (
                  <Cell key={i} fill={TRANSPORT_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
          {volumeByTransport.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TRANSPORT_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }} />
              <span className="text-[11px] text-stone-500">{d.name}</span>
            </div>
          ))}
        </div>
      </Link>

      {/* Shipment Status */}
      <Link href="/shipments" className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-shadow">
        <h3 className="text-xs font-semibold text-stone-500 mb-1">Shipments by Status</h3>
        <div style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={volumeByStatus} cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                paddingAngle={3} dataKey="value" labelLine={false} label={PieLabel as never}>
                {volumeByStatus.map((d, i) => (
                  <Cell key={i} fill={STATUS_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
          {volumeByStatus.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[d.name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }} />
              <span className="text-[11px] text-stone-500">{d.name}</span>
            </div>
          ))}
        </div>
      </Link>

      </div>
    </div>
  );
}
