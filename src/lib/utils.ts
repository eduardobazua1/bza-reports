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
  const parts = date.split("T")[0].split("-");
  if (parts.length === 3) {
    const mm = parts[1].padStart(2, "0");
    const dd = parts[2].padStart(2, "0");
    return `${mm}/${dd}/${parts[0]}`;
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
  programado: "bg-stone-100 text-stone-600",
  en_transito: "bg-blue-100 text-[#0d9488]",
  en_aduana: "bg-[#0d9488] text-[#0d9488]",
  entregado: "bg-emerald-100 text-emerald-700",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
};

export const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-100 text-[#0d9488]",
  unpaid: "bg-[#0d3d3b] text-[#0d3d3b]",
};

export const transportTypeLabels: Record<string, string> = {
  ffcc: "Railroad",
  ship: "Maritime",
  truck: "Truck",
};
