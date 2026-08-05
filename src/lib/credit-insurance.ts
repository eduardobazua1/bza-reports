// Credit-insurance policy logic for Allianz Trade policy P1006353.
// Pure functions + config — no DB access here (see src/server/credit-insurance.ts).

export const POLICY = {
  number: "P1006353",
  insurer: "Allianz Trade",
  insurerLegal: "Euler Hermes North America Insurance Company",
  type: "Corporate Advantage",
  insuredPct: 0.9, // 90% indemnity
  maxLiability: 2_000_000, // USD per policy period
  maxTermsDays: 60, // Mexico
  maxTermsUsDays: 30, // United States
  mepDays: 60, // Maximum Extension Period
  reportThreshold: 10_000, // State-of-Default reporting threshold (USD)
  waitingDays: 120, // Mexico waiting period (protracted default)
  nonQualifyingLoss: 1_500, // losses below this are not indemnified
  annualSalesEst: 15_000_000, // estimated annual insurable sales
  premium: 41_640, // expected/minimum annual premium (0.2776%)
  premiumRate: "0.2776%",
  declarationDue: "within 15 days of the period end",
  periodLabel: "01 Jun 2026 – 31 May 2027",
  portalUrl: "https://online.allianz-trade.com",
} as const;

export type CoverType = "full" | "partial" | "none";

export type BuyerCover = {
  clientId: number | null; // null = has cover but not a TMS client
  name: string;
  ehid: string;
  grade: number;
  cover: CoverType;
  limit: number;
};

// Approved limits from the Allianz portal (Jul 2026). Edit here when limits change.
export const BUYER_COVER: BuyerCover[] = [
  { clientId: 3, name: "Kimberly-Clark de México", ehid: "6378659", grade: 2, cover: "full", limit: 2_000_000 },
  { clientId: 5, name: "Bio Pappel (Biopappel Scribe)", ehid: "107543296", grade: 6, cover: "partial", limit: 1_500_000 },
  { clientId: 8, name: "Grupo Corporativo Papelera", ehid: "90113960", grade: 4, cover: "partial", limit: 600_000 },
  { clientId: null, name: "Blue Tissue", ehid: "117050044", grade: 6, cover: "full", limit: 100_000 },
];

export function coverForClient(clientId: number): BuyerCover | undefined {
  return BUYER_COVER.find((b) => b.clientId === clientId);
}

// ── Invoice status against the policy clock ───────────────────────────────────
export type InvoiceStatusKey = "in_default" | "crossing" | "overdue" | "current" | "no_due";

export type InvoiceStatus = {
  key: InvoiceStatusKey;
  label: string;
  severity: "critical" | "warning" | "caution" | "ok" | "neutral";
  daysLate: number | null;
  defaultDate: string | null; // ISO — date it reaches 60 days overdue
  reportBy: string | null; // ISO — deadline to report the State of Default
};

const DAY = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Report deadline = 15th of the month AFTER the invoice crosses 60 days overdue.
function reportByDate(defaultDate: Date): Date {
  return new Date(Date.UTC(defaultDate.getUTCFullYear(), defaultDate.getUTCMonth() + 1, 15));
}

export function classifyInvoice(dueDate: string | null, today: Date): InvoiceStatus {
  if (!dueDate) {
    return { key: "no_due", label: "No due date", severity: "neutral", daysLate: null, defaultDate: null, reportBy: null };
  }
  const due = new Date(dueDate + "T00:00:00Z");
  const daysLate = Math.floor((today.getTime() - due.getTime()) / DAY);
  const defaultAt = new Date(due.getTime() + POLICY.mepDays * DAY);
  const rep = reportByDate(defaultAt);
  const common = { defaultDate: iso(defaultAt), reportBy: iso(rep) };

  if (daysLate >= POLICY.mepDays) {
    return { key: "in_default", label: "In default", severity: "critical", daysLate, ...common };
  }
  if (daysLate >= POLICY.mepDays - 5) {
    return { key: "crossing", label: `Crosses 60d in ${POLICY.mepDays - daysLate}d`, severity: "warning", daysLate, ...common };
  }
  if (daysLate >= 1) {
    return { key: "overdue", label: `Overdue ${daysLate}d`, severity: "caution", daysLate, ...common };
  }
  return { key: "current", label: daysLate === 0 ? "Due today" : `Not due (${-daysLate}d)`, severity: "ok", daysLate, ...common };
}

// Insured vs uninsured split for a buyer's total outstanding, capped at the limit.
export function coverageSplit(outstanding: number, limit: number) {
  const insured = Math.min(outstanding, limit);
  const uninsured = Math.max(0, outstanding - limit);
  return { insured, uninsured };
}
