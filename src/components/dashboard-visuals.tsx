"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import Link from "next/link";

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777"];

export function DashboardVisuals({
  volumeByMonth,
  volumeByTransport,
  volumeByStatus,
  volumeByClient,
  volumeBySupplier,
}: {
  volumeByMonth: { month: string; tons: number }[];
  volumeByTransport: { name: string; value: number }[];
  volumeByStatus: { name: string; value: number }[];
  volumeByClient: { name: string; value: number }[];
  volumeBySupplier?: { name: string; value: number }[];
  volumeByIncoterm?: { name: string; value: number }[];
}) {
  const chartCard = "bg-white rounded-md shadow-sm p-4 block hover:shadow-md transition-shadow";

  return (
    <div className="space-y-4">
      <Link href="/reports" className={chartCard}>
        <h3 className="text-sm font-medium text-stone-600 mb-3">Volume by Month (TN)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={volumeByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#78716c" }} />
            <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
            <Bar dataKey="tons" fill="#2563eb" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* By Transport Type */}
        <Link href="/reports" className={chartCard}>
          <h3 className="text-sm font-medium text-stone-600 mb-2">By Transport Type</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={volumeByTransport} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {volumeByTransport.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-1 justify-center">
            {volumeByTransport.map((d, i) => {
              const total = volumeByTransport.reduce((s, x) => s + x.value, 0);
              return (
                <div key={d.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-stone-500">{d.name} {Math.round(d.value / total * 100)}%</span>
                </div>
              );
            })}
          </div>
        </Link>

        {/* By Status */}
        <Link href="/shipments" className={chartCard}>
          <h3 className="text-sm font-medium text-stone-600 mb-2">By Status</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={volumeByStatus} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {volumeByStatus.map((entry, i) => {
                  const statusColors: Record<string, string> = {
                    "Delivered": "#059669", "In Transit": "#2563eb", "Customs": "#d97706", "Scheduled": "#a8a29e",
                  };
                  return <Cell key={i} fill={statusColors[entry.name] || COLORS[i]} />;
                })}
              </Pie>
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-1 justify-center">
            {volumeByStatus.map((d) => {
              const total = volumeByStatus.reduce((s, x) => s + x.value, 0);
              const statusColors: Record<string, string> = {
                "Delivered": "#059669", "In Transit": "#2563eb", "Customs": "#d97706", "Scheduled": "#a8a29e",
              };
              return (
                <div key={d.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: statusColors[d.name] || "#a8a29e" }} />
                  <span className="text-xs text-stone-500">{d.name} {Math.round(d.value / total * 100)}%</span>
                </div>
              );
            })}
          </div>
        </Link>

        {/* By Client */}
        <Link href="/clients" className={chartCard}>
          <h3 className="text-sm font-medium text-stone-600 mb-3">By Client</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={volumeByClient} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#78716c" }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: "#78716c" }} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Link>

        {/* By Supplier */}
        {volumeBySupplier && volumeBySupplier.length > 0 && (
          <Link href="/suppliers" className={chartCard}>
            <h3 className="text-sm font-medium text-stone-600 mb-3">By Supplier</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={volumeBySupplier} layout="vertical" margin={{ left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#78716c" }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: "#78716c" }} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} TN`, "Volume"]} />
                <Bar dataKey="value" fill="#059669" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Link>
        )}
      </div>
    </div>
  );
}
