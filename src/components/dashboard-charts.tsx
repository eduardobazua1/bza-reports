"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type RevenueByYear = {
  year: string;
  revenue: number;
  cost: number;
  profit: number;
  tons: number;
};

type ProfitByClient = {
  client: string;
  revenue: number;
  cost: number;
  profit: number;
  tons: number;
  margin: number;
};

export function DashboardCharts({
  revenueByYear,
  profitByClient,
}: {
  revenueByYear: RevenueByYear[];
  profitByClient: ProfitByClient[];
}) {
  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue by Year */}
      <div className="bg-white rounded-md shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">Revenue / Cost / Profit by Year</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByYear} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="year" fontSize={12} />
              <YAxis tickFormatter={currencyFormatter} fontSize={12} />
              <Tooltip
                formatter={(value) => currencyFormatter(Number(value))}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend fontSize={12} />
              <Bar dataKey="revenue" name="Revenue" fill="#1a56db" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cost" name="Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Profit by Client */}
      <div className="bg-white rounded-md shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-4">Profit by Client</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={profitByClient.slice(0, 10)}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tickFormatter={currencyFormatter} fontSize={12} />
              <YAxis type="category" dataKey="client" fontSize={12} width={70} />
              <Tooltip
                formatter={(value) => currencyFormatter(Number(value))}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="profit" name="Profit" fill="#1a56db" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
