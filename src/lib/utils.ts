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
  en_transito: "bg-[#ccfbf1] text-[#0d3d3b]",
  en_aduana: "bg-[#ccfbf1] text-[#0d3d3b]",
  entregado: "bg-[#0d3d3b] text-[#6ee7b7]",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
};

export const paymentStatusColors: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-stone-100 text-stone-500",
};

export const transportTypeLabels: Record<string, string> = {
  ffcc: "Railroad",
  ship: "Maritime",
  truck: "Truck",
};

export const contractStatusLabels: Record<string, string> = {
  draft:     "Draft",
  active:    "Active",
  expired:   "Expired",
  cancelled: "Cancelled",
};

export const contractStatusColors: Record<string, string> = {
  draft:     "bg-stone-100 text-stone-500",
  active:    "bg-[#ccfbf1] text-[#0d3d3b]",
  expired:   "bg-stone-200 text-stone-500",
  cancelled: "bg-red-50 text-red-600",
};

export function formatPriceFormula(
  priceType: string,
  price: number | null | undefined,
  margin: number | null | undefined,
  marketRef: string | null | undefined,
): string {
  if (priceType === "fixed") return price != null ? formatCurrency(price) + "/t" : "—";
  if (priceType === "cost_plus") return margin != null ? `Cost + $${margin}/t` : "Cost+";
  if (priceType === "market_plus") return `${marketRef || "Market"} + $${margin ?? "?"}/t`;
  return "—";
}
