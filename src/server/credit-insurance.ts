import { db } from "@/db";
import { invoices, purchaseOrders, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  BUYER_COVER,
  POLICY,
  classifyInvoice,
  coverageSplit,
  type InvoiceStatus,
} from "@/lib/credit-insurance";

export type CIInvoice = {
  invoiceNumber: string;
  dueDate: string | null;
  amount: number;
  usesFactoring: boolean;
  status: InvoiceStatus;
  claimFileBy: string | null; // deadline to file a claim (protracted default), ISO
};

export type CIClient = {
  clientId: number | null;
  name: string;
  ehid: string;
  grade: number;
  cover: string;
  limit: number;
  outstanding: number;
  insured: number;
  uninsured: number;
  inDefaultCount: number;
  crossingCount: number;
  invoices: CIInvoice[];
};

export type CIAction = {
  id: string;
  priority: "critical" | "high" | "info";
  title: string;
  why: string;
  deadline: string | null; // ISO
  daysLeft: number | null;
  steps: { text: string; copy?: string; copyLabel?: string }[];
  portalLabel: string;
};

export type CICounts = {
  toReport: number; // invoices in State of Default (must report)
  approaching: number; // invoices about to cross 60 days
  overdue: number; // overdue but still inside the 60-day window
  buyersOverLimit: number; // buyers whose outstanding exceeds their limit
};

export type CreditInsuranceData = {
  asOf: string;
  totalReceivables: number;
  totalInsured: number;
  totalUninsured: number;
  buyersNeedingAction: number;
  nearestDeadline: string | null;
  nearestDaysLeft: number | null;
  counts: CICounts;
  clients: CIClient[];
  actions: CIAction[];
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysUntil = (isoDate: string, from: Date) => Math.round((new Date(isoDate + "T00:00:00Z").getTime() - from.getTime()) / DAY);

export async function getCreditInsuranceData(): Promise<CreditInsuranceData> {
  const today = new Date();
  const now = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const coveredClientIds = BUYER_COVER.map((b) => b.clientId).filter((id): id is number => id !== null);

  // Every unpaid invoice, with PO sell price + client + shipment date.
  const rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      dueDate: invoices.dueDate,
      shipmentDate: invoices.shipmentDate,
      quantityTons: invoices.quantityTons,
      sellPriceOverride: invoices.sellPriceOverride,
      poSellPrice: purchaseOrders.sellPrice,
      usesFactoring: invoices.usesFactoring,
      clientId: purchaseOrders.clientId,
      clientName: clients.name,
    })
    .from(invoices)
    .innerJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .innerJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .where(eq(invoices.customerPaymentStatus, "unpaid"));

  const amountOf = (r: (typeof rows)[number]) => (r.quantityTons ?? 0) * (r.sellPriceOverride ?? r.poSellPrice ?? 0);

  // Claim-filing deadline (protracted default): 90 days after MEP end (= due+150), or 180 days after supply, whichever is later.
  function claimFileByFor(dueDate: string | null, shipmentDate: string | null): string | null {
    if (!dueDate) return null;
    const a = new Date(dueDate + "T00:00:00Z").getTime() + (POLICY.mepDays + 90) * DAY;
    const b = shipmentDate ? new Date(shipmentDate + "T00:00:00Z").getTime() + 180 * DAY : 0;
    return iso(new Date(Math.max(a, b)));
  }

  // Group covered clients' invoices; collect uncovered clients that have open invoices.
  const byClient = new Map<number, CIInvoice[]>();
  const uncovered = new Map<number, { name: string; count: number; amount: number }>();
  for (const r of rows) {
    if (coveredClientIds.includes(r.clientId)) {
      const status = classifyInvoice(r.dueDate, now);
      const claimFileBy = status.key === "in_default" ? claimFileByFor(r.dueDate, r.shipmentDate) : null;
      const list = byClient.get(r.clientId) ?? [];
      list.push({ invoiceNumber: r.invoiceNumber, dueDate: r.dueDate, amount: amountOf(r), usesFactoring: r.usesFactoring, status, claimFileBy });
      byClient.set(r.clientId, list);
    } else {
      const e = uncovered.get(r.clientId) ?? { name: r.clientName ?? `Client ${r.clientId}`, count: 0, amount: 0 };
      e.count++;
      e.amount += amountOf(r);
      uncovered.set(r.clientId, e);
    }
  }

  const ciClients: CIClient[] = BUYER_COVER.map((b) => {
    const invs = (b.clientId != null ? byClient.get(b.clientId) : undefined) ?? [];
    invs.sort((a, x) => (x.status.daysLate ?? -9999) - (a.status.daysLate ?? -9999));
    const outstanding = invs.reduce((s, i) => s + i.amount, 0);
    const { insured, uninsured } = coverageSplit(outstanding, b.limit);
    return {
      clientId: b.clientId,
      name: b.name,
      ehid: b.ehid,
      grade: b.grade,
      cover: b.cover,
      limit: b.limit,
      outstanding,
      insured,
      uninsured,
      inDefaultCount: invs.filter((i) => i.status.key === "in_default").length,
      crossingCount: invs.filter((i) => i.status.key === "crossing").length,
      invoices: invs,
    };
  });

  const totalReceivables = ciClients.reduce((s, c) => s + c.outstanding, 0);
  const totalInsured = ciClients.reduce((s, c) => s + c.insured, 0);
  const totalUninsured = ciClients.reduce((s, c) => s + c.uninsured, 0);
  const buyersNeedingAction = ciClients.filter((c) => c.inDefaultCount > 0 || c.uninsured > 0).length;

  // ── Build prioritized actions ───────────────────────────────────────────────
  const actions: CIAction[] = [];

  for (const c of ciClients) {
    const defaulted = c.invoices.filter((i) => i.status.key === "in_default");
    const toReportInv = defaulted.filter((i) => (i.status.daysLate ?? 0) < POLICY.waitingDays);
    const claimInv = defaulted.filter((i) => (i.status.daysLate ?? 0) >= POLICY.waitingDays);

    // Critical: file a claim — unpaid past the waiting period (protracted default). This is your money.
    if (claimInv.length > 0) {
      const by = claimInv.map((i) => i.claimFileBy).filter((d): d is string => !!d).sort()[0] ?? null;
      const total = claimInv.reduce((s, i) => s + i.amount, 0);
      actions.push({
        id: `claim-${c.clientId}`,
        priority: "critical",
        title: `File a claim for ${c.name} — unpaid past the ${POLICY.waitingDays}-day waiting period`,
        why: `${claimInv.length} invoice${claimInv.length > 1 ? "s" : ""} (${money(total)}) are still unpaid past the ${POLICY.waitingDays}-day waiting period (protracted default). File the Claim & Collection form by the deadline or you forfeit the indemnity.`,
        deadline: by,
        daysLeft: by ? daysUntil(by, now) : null,
        steps: [],
        portalLabel: "",
      });
    }

    // Critical: report a State of Default (60–119 days) → keeps cover alive.
    if (toReportInv.length > 0) {
      const rep = toReportInv.map((i) => i.status.reportBy).filter((d): d is string => !!d).sort()[0] ?? null;
      const total = toReportInv.reduce((s, i) => s + i.amount, 0);
      actions.push({
        id: `report-${c.clientId}`,
        priority: "critical",
        title: `Report ${c.name} to Allianz — "State of Default"`,
        why: `${toReportInv.length} invoice${toReportInv.length > 1 ? "s" : ""} (${money(total)}) passed the 60-day limit. Report by the deadline or cover on ${c.name} is cancelled for future shipments. This keeps cover alive — it is not a claim.`,
        deadline: rep,
        daysLeft: rep ? daysUntil(rep, now) : null,
        steps: [],
        portalLabel: "",
      });
    }
  }

  // High: uninsured exposure above the limit (raise limit) or at the policy ceiling.
  for (const c of ciClients) {
    if (c.uninsured > 0) {
      const suggested = Math.min(Math.ceil((c.outstanding * 1.15) / 100_000) * 100_000, POLICY.maxLiability);
      if (suggested > c.limit) {
        actions.push({
          id: `increase-${c.clientId}`,
          priority: "high",
          title: `Raise ${c.name}'s credit limit to ${money(suggested)}`,
          why: `You are owed ${money(c.outstanding)} but only ${money(c.limit)} is insured — ${money(c.uninsured)} sits uninsured. ${c.grade <= 3 ? "Strong grade, likely easy to approve." : "Attach recent payment history to support the request."}`,
          deadline: null,
          daysLeft: null,
          steps: [],
          portalLabel: "",
        });
      } else {
        actions.push({
          id: `ceiling-${c.clientId}`,
          priority: "info",
          title: `${c.name} is at the ${money(c.limit)} policy ceiling — ${money(c.uninsured)} can't be insured`,
          why: `${c.name}'s limit equals your policy Max Liability (${money(POLICY.maxLiability)}), so the ${money(c.uninsured)} above it can't be covered. Collect the oldest invoices to bring the balance under ${money(c.limit)}, or discuss a higher Max Liability at renewal.`,
          deadline: null,
          daysLeft: null,
          steps: [],
          portalLabel: "",
        });
      }
    }
  }

  // High: sales to a buyer with NO credit limit → uninsured; request a limit before shipping more.
  for (const [cid, e] of uncovered) {
    actions.push({
      id: `nolimit-${cid}`,
      priority: "high",
      title: `Request a credit limit for ${e.name}`,
      why: `${e.name} has ${e.count} open invoice${e.count > 1 ? "s" : ""} (${money(e.amount)}) but no approved limit — these sales are uninsured. Request a Permitted Limit so future shipments are covered before you ship.`,
      deadline: null,
      daysLeft: null,
      steps: [],
      portalLabel: "",
    });
  }

  // High: factored invoices that are insured → possible §14 conflict.
  const factored = ciClients.flatMap((c) => c.invoices.filter((i) => i.usesFactoring).map((i) => i.invoiceNumber));
  if (factored.length > 0) {
    actions.push({
      id: "factoring",
      priority: "high",
      title: `${factored.length} insured invoice${factored.length > 1 ? "s are" : " is"} factored — verify cover isn't voided`,
      why: `Policy §14: assigning an insured receivable to a factor can void cover unless endorsed. Confirm with your broker before relying on cover for: ${factored.join(", ")}.`,
      deadline: null,
      daysLeft: null,
      steps: [],
      portalLabel: "",
    });
  }

  // Info: annual turnover declaration window (policy period ends 31 May → declare by 15 Jun).
  const decYear = now.getUTCFullYear();
  const decDeadline = iso(new Date(Date.UTC(decYear, 5, 15))); // Jun 15
  const decStart = new Date(Date.UTC(decYear, 4, 1)); // May 1
  if (now >= decStart && now <= new Date(decDeadline + "T00:00:00Z")) {
    actions.push({
      id: "turnover-declaration",
      priority: "info",
      title: "Declare your annual sales to Allianz",
      why: `Your policy period ended 31 May. Declare your total sales ${POLICY.declarationDue} so Allianz can set the final premium.`,
      deadline: decDeadline,
      daysLeft: daysUntil(decDeadline, now),
      steps: [],
      portalLabel: "",
    });
  }

  // sort: critical (by soonest deadline) → high → info
  const rank = { critical: 0, high: 1, info: 2 } as const;
  actions.sort((a, b) => {
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });

  const nearest = actions.filter((a) => a.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))[0];

  // Count chips
  let toReport = 0, approaching = 0, overdue = 0;
  for (const c of ciClients) {
    for (const i of c.invoices) {
      if (i.status.key === "in_default") toReport++;
      else if (i.status.key === "crossing") approaching++;
      else if (i.status.key === "overdue") overdue++;
    }
  }
  const counts: CICounts = { toReport, approaching, overdue, buyersOverLimit: ciClients.filter((c) => c.uninsured > 0).length };

  return {
    asOf: iso(now),
    totalReceivables,
    totalInsured,
    totalUninsured,
    buyersNeedingAction,
    nearestDeadline: nearest?.deadline ?? null,
    nearestDaysLeft: nearest?.daysLeft ?? null,
    counts,
    clients: ciClients,
    actions,
  };
}

function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
