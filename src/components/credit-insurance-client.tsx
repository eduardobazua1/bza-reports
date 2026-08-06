"use client";

import { useState, Fragment } from "react";
import type { CreditInsuranceData, CIClient, CIInvoice } from "@/server/credit-insurance";
import { POLICY } from "@/lib/credit-insurance";
import { AlertTriangle, ChevronDown, ShieldCheck, Clock, TrendingUp } from "lucide-react";

// ── formatters ────────────────────────────────────────────────────────────────
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const compact = (n: number) =>
  n >= 1_000_000 ? "$" + (n / 1_000_000).toFixed(2) + "M" : n >= 1000 ? "$" + Math.round(n / 1000) + "K" : "$" + n;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const shortDate = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";

// BZA palette only — severity encoded by teal intensity (dark → light) + stone.
const SEV = {
  critical: { text: "text-[#0d3d3b]", chip: "bg-[#0d3d3b] text-white border-[#0d3d3b]", dot: "bg-[#0d3d3b]" },
  warning: { text: "text-[#0d3d3b]", chip: "bg-[#c2e0da] text-[#0d3d3b] border-[#0d3d3b]/20", dot: "bg-[#2f8a80]" },
  caution: { text: "text-stone-600", chip: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-400" },
  ok: { text: "text-[#0d3d3b]", chip: "bg-[#e6f1ee] text-[#0d3d3b] border-[#0d3d3b]/20", dot: "bg-[#0d3d3b]" },
  neutral: { text: "text-stone-600", chip: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-300" },
} as const;

// ── count chip (uniform BZA teal, subtle) ─────────────────────────────────────
// KPI card — consistent with the audit / dashboard KPIs (BZA palette).
function CiKpi({ icon: Icon, label, value, active, tone }: { icon: typeof AlertTriangle; label: string; value: number; active?: boolean; tone?: "stone" }) {
  const cls = tone === "stone" ? "bg-stone-100 text-stone-600" : active ? "bg-[#0d3d3b] text-white" : "bg-[#e6f1ee] text-[#0d3d3b]";
  return (
    <div className={`rounded-lg p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

// ── client status row ─────────────────────────────────────────────────────────
function ClientRow({ c }: { c: CIClient }) {
  const needsAction = c.inDefaultCount > 0;
  const stat = needsAction
    ? { cls: SEV.critical, label: "Action needed", icon: true }
    : c.uninsured > 0
    ? { cls: SEV.warning, label: "Under-insured", icon: true }
    : c.clientId == null
    ? { cls: SEV.neutral, label: "Not in TMS", icon: false }
    : { cls: SEV.ok, label: "Covered", icon: false };

  return (
    <div className={`bg-white rounded-md shadow-sm border ${needsAction ? "border-stone-200" : "border-stone-200"} p-3 flex items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900 truncate">{c.name}</p>
        <p className="text-[11px] text-stone-400 mt-0.5">Grade {c.grade} · {c.cover} cover · limit {usd(c.limit)}</p>
      </div>
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${stat.cls.chip}`}>
        {stat.icon && <AlertTriangle className="w-3 h-3" />}{stat.label}
      </span>
    </div>
  );
}

// ── invoice breakdown (interactive, no buttons) ───────────────────────────────
function whatToDo(inv: CIInvoice): { title: string; body: string; critical: boolean } {
  const st = inv.status;
  const def = shortDate(st.defaultDate);
  const rep = fmtDate(st.reportBy);
  if (st.key === "in_default" && st.daysLate != null && st.daysLate >= POLICY.waitingDays)
    return { title: "File a claim now", body: `Unpaid ${st.daysLate} days — past the ${POLICY.waitingDays}-day waiting period (protracted default). File the Claim & Collection form by ${fmtDate(inv.claimFileBy)} or you forfeit the indemnity.`, critical: true };
  if (st.key === "in_default")
    return { title: "Report this to Allianz now", body: `Passed 60 days overdue on ${def}. File a State-of-Default report for this buyer by ${rep} or cover is cancelled for future shipments. This is a report to keep cover — not a claim. If it stays unpaid, a claim becomes due after ${POLICY.waitingDays} days.`, critical: true };
  if (st.key === "crossing")
    return { title: "About to enter default — act this week", body: `Hits 60 days overdue on ${def}. Chase payment now; if still unpaid it must be reported by ${rep}.`, critical: false };
  if (st.key === "overdue")
    return { title: "Overdue — inside the collection window", body: `Overdue but still within the 60-day extension period. Keep collecting; no report needed yet. It would enter State of Default on ${def} (report by ${rep}) if unpaid.`, critical: false };
  if (st.key === "current")
    return { title: "On track — nothing to do", body: `Not due yet. Insured up to the buyer's limit as long as it's paid within terms.`, critical: false };
  return { title: "Missing due date", body: `No due date on file, so the insurance clock can't run. Set the invoice due date so the module can track it.`, critical: false };
}

function InvoiceTable({ c }: { c: CIClient }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 flex-wrap">
        <span className="text-sm font-semibold text-stone-800">{c.name}</span>
        {c.inDefaultCount > 0 && <span className="text-xs font-semibold text-stone-700">{c.inDefaultCount} in default</span>}
        <span className="text-xs text-stone-500">· <b className="font-semibold text-stone-700 tabular-nums">{usd(c.outstanding)}</b> owed{c.uninsured > 0 ? <> · <b className="font-semibold text-stone-700 tabular-nums">{compact(c.uninsured)}</b> uninsured</> : ""}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400">
              <th className="text-left font-semibold px-4 py-2.5">Invoice</th>
              <th className="text-left font-semibold px-4 py-2.5">Due date</th>
              <th className="text-right font-semibold px-4 py-2.5">Amount</th>
              <th className="text-right font-semibold px-4 py-2.5">Days late</th>
              <th className="text-left font-semibold px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {c.invoices.map((inv) => {
              const sev = SEV[inv.status.severity];
              const isOpen = open === inv.invoiceNumber;
              const d = whatToDo(inv);
              return (
                <Fragment key={inv.invoiceNumber}>
                  <tr className="border-t border-stone-100 hover:bg-stone-50/60">
                    <td className="px-4 py-2.5 font-mono text-stone-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-stone-500">{shortDate(inv.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">{usd(inv.amount)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${sev.text}`}>{inv.status.daysLate ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setOpen(isOpen ? null : inv.invoiceNumber)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${sev.chip}`}
                      >
                        {inv.status.label}
                        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-stone-50/80">
                      <td colSpan={5} className="px-4 py-3">
                        <p className={`text-sm font-semibold flex items-center gap-2 ${d.critical ? "text-stone-700" : "text-stone-800"}`}>
                          {d.critical && <AlertTriangle className="w-4 h-4" />}{d.title}
                        </p>
                        <p className="text-sm text-stone-500 mt-1 max-w-2xl">{d.body}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {c.invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-stone-400">No open invoices — nothing at risk.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Policy summary tab ────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-md shadow-sm border border-stone-200 p-3">
      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-stone-800 mt-1">{value}</p>
    </div>
  );
}

function PolicySummary({ clients }: { clients: CIClient[] }) {
  const rules: [string, string][] = [
    ["Get a limit before you ship", "Each buyer needs an approved credit limit before you supply. There's no discretionary limit — nothing is auto-covered."],
    ["Covered up to the limit", "You're insured up to the buyer's approved limit; anything owed above it you carry yourself."],
    ["Report late buyers on time", `If a buyer is 60+ days past due and owes more than ${usd(POLICY.reportThreshold)}, report it by the 15th of the next month — or cover on that buyer is cancelled.`],
    ["Claim window", `If they still don't pay, the claim is payable ${POLICY.waitingDays} days after the due date (protracted default). File the claim within the claim window.`],
    ["Declare sales yearly", `Declare your total sales once a year, ${POLICY.declarationDue}, so Allianz can set the final premium.`],
  ];
  return (
    <div className="space-y-6">
      {/* what it is */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-4">
        <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
          <b className="text-stone-900">{POLICY.insurer}</b> ({POLICY.insurerLegal}) insures BZA&apos;s receivables from covered buyers.
          If a covered buyer fails to pay, they reimburse <b>{POLICY.insuredPct * 100}%</b> of the loss, up to that buyer&apos;s approved limit —
          capped at <b>{usd(POLICY.maxLiability)}</b> in total per policy year.
        </p>
      </div>

      {/* terms */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Policy terms</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Policy" value={`${POLICY.number} · ${POLICY.type}`} />
          <Stat label="Period" value={POLICY.periodLabel} />
          <Stat label="Indemnity" value={`${POLICY.insuredPct * 100}%`} />
          <Stat label="Max liability / yr" value={usd(POLICY.maxLiability)} />
          <Stat label="Max payment terms" value={`${POLICY.maxTermsDays}d MX · ${POLICY.maxTermsUsDays}d US`} />
          <Stat label="Extension period" value={`${POLICY.mepDays} days`} />
          <Stat label="Waiting period" value={`${POLICY.waitingDays} days (MX)`} />
          <Stat label="Report threshold" value={usd(POLICY.reportThreshold)} />
          <Stat label="Non-qualifying loss" value={usd(POLICY.nonQualifyingLoss)} />
          <Stat label="Annual premium" value={`${usd(POLICY.premium)} · ${POLICY.premiumRate}`} />
          <Stat label="Est. annual sales" value={usd(POLICY.annualSalesEst)} />
          <Stat label="Sales declaration" value={POLICY.declarationDue} />
        </div>
      </div>

      {/* covered buyers */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Covered buyers</p>
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-stone-400">
                <th className="text-left font-semibold px-4 py-2.5">Buyer</th>
                <th className="text-left font-semibold px-4 py-2.5">EHID</th>
                <th className="text-center font-semibold px-4 py-2.5">Grade</th>
                <th className="text-left font-semibold px-4 py-2.5">Cover</th>
                <th className="text-right font-semibold px-4 py-2.5">Limit</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.ehid} className="border-t border-stone-100">
                  <td className="px-4 py-2.5 text-stone-800 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-stone-500">{c.ehid}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-stone-600">{c.grade}</td>
                  <td className="px-4 py-2.5 text-stone-600 capitalize">{c.cover}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-stone-800 font-semibold">{usd(c.limit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* how it works */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">How your cover works</p>
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 divide-y divide-stone-100">
          {rules.map(([t, d]) => (
            <div key={t} className="px-4 py-3">
              <p className="text-sm font-medium text-stone-900">{t}</p>
              <p className="text-xs text-stone-500 mt-0.5 max-w-3xl leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CreditInsuranceClient({ data }: { data: CreditInsuranceData }) {
  const withInvoices = data.clients.filter((c) => c.invoices.length > 0);
  const { counts } = data;
  const [tab, setTab] = useState<"status" | "policy">("status");

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center gap-2 text-[#0d3d3b]">
        <ShieldCheck className="w-5 h-5" />
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Credit Insurance</h1>
      </div>

      {/* tabs */}
      <div className="flex gap-6 border-b border-stone-200">
        {(["status", "policy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 -mb-px text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-[#0d3d3b] text-[#0d3d3b]" : "border-transparent text-stone-400 hover:text-stone-600"}`}
          >
            {t === "status" ? "Alerts & status" : "Policy summary"}
          </button>
        ))}
      </div>

      {tab === "policy" ? (
        <PolicySummary clients={data.clients} />
      ) : (
      <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <CiKpi icon={AlertTriangle} label="To report" value={counts.toReport} active={counts.toReport > 0} />
        <CiKpi icon={Clock} label="Approaching 60d" value={counts.approaching} tone="stone" />
        <CiKpi icon={AlertTriangle} label="Overdue" value={counts.overdue} active={counts.overdue > 0} />
        <CiKpi icon={TrendingUp} label="Buyers over limit" value={counts.buyersOverLimit} active={counts.buyersOverLimit > 0} />
      </div>

      {/* To-do list */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">To do</p>
        {data.actions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-[#0d3d3b]/20 p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0d3d3b]" />
            <p className="text-sm text-stone-600">Nothing pending — no invoices in default and all exposure within limits.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 divide-y divide-stone-100">
            {data.actions.map((a) => {
              const tone = a.priority === "critical" ? SEV.critical : a.priority === "high" ? SEV.warning : SEV.neutral;
              const meta =
                a.deadline
                  ? `Due ${fmtDate(a.deadline)}${a.daysLeft != null ? ` · ${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left` : ""}`
                  : a.priority === "high"
                  ? "No deadline"
                  : "";
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${tone.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{a.title}</p>
                    {meta && <p className={`text-xs mt-0.5 ${a.priority === "critical" ? "text-stone-600 font-medium" : "text-stone-400"}`}>{meta}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status by client */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Status by client</p>
        <div className="space-y-2">{data.clients.map((c) => <ClientRow key={c.ehid} c={c} />)}</div>
      </div>

      {/* Breakdown */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Invoices &amp; status</p>
        <div className="space-y-4">
          {withInvoices.map((c) => <InvoiceTable key={c.ehid} c={c} />)}
          {withInvoices.length === 0 && <p className="text-sm text-stone-400">No open invoices across covered buyers.</p>}
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
