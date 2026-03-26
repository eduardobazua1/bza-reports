export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  // Parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one timezone bug
  const parts = date.split("T")[0].split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return date;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export const shipmentStatusLabels: Record<string, string> = {
  programado: "Scheduled",
  en_transito: "In Transit",
  en_aduana: "Customs",
  entregado: "Delivered",
};

export const shipmentStatusColors: Record<string, string> = {
  programado: "bg-gray-100 text-gray-700",
  en_transito: "bg-blue-100 text-blue-700",
  en_aduana: "bg-yellow-100 text-yellow-700",
  entregado: "bg-green-100 text-green-700",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
};

export const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  unpaid: "bg-red-100 text-red-700",
};

export const transportTypeLabels: Record<string, string> = {
  ffcc: "Railroad",
  ship: "Maritime",
  truck: "Truck",
};
