import { db } from "@/db";
import { invoices, purchaseOrders, clients, scheduledReports, reportTemplates, proposals, certificates, customerCertificates, activityLog } from "@/db/schema";
import { and, eq, lt, lte, gte, ne, or, isNull, isNotNull, desc } from "drizzle-orm";

export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationType =
  | "overdue"
  | "due_soon"
  | "stale_shipment"
  | "pending_report"
  | "proposal_expiring"
  | "key_date"
  | "cert_expiry"
  | "portal_login";

// Important fixed deadlines to surface as they approach. Add dates here as they come up.
const KEY_DATES: { id: string; label: string; date: string; link: string; note?: string }[] = [
  { id: "cu-audit-2026", label: "Control Union FSC/PEFC audit", date: "2026-10-31", link: "/reports/audit-export", note: "On-site audit — have the audit package ready" },
];

export type AppNotification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  description: string;
  link: string;
  date: string | null;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const today = new Date().toISOString().split("T")[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const ago5Days = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0];

  const results: AppNotification[] = [];

  // ── 1. Overdue invoices ───────────────────────────────────────────────────
  try {
    const overdueRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        quantityTons: invoices.quantityTons,
        sellPrice: purchaseOrders.sellPrice,
        sellPriceOverride: invoices.sellPriceOverride,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
      .where(
        and(
          eq(invoices.customerPaymentStatus, "unpaid"),
          isNotNull(invoices.dueDate),
          lt(invoices.dueDate, today)
        )
      )
      .orderBy(invoices.dueDate);

    for (const row of overdueRows) {
      const amount = row.quantityTons * (row.sellPriceOverride ?? row.sellPrice ?? 0);
      const daysOverdue = Math.floor(
        (Date.now() - new Date(row.dueDate!).getTime()) / 86400000
      );
      results.push({
        id: `overdue-${row.id}`,
        type: "overdue",
        severity: "critical",
        title: `Overdue: ${row.invoiceNumber}`,
        description: `${row.clientName ?? "Unknown"} — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} past due`,
        link: "/payments",
        date: row.dueDate,
      });
    }
  } catch {
    // table may not exist in this environment — skip silently
  }

  // ── 2. Invoices due within 7 days ─────────────────────────────────────────
  try {
    const dueSoonRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        dueDate: invoices.dueDate,
        quantityTons: invoices.quantityTons,
        sellPrice: purchaseOrders.sellPrice,
        sellPriceOverride: invoices.sellPriceOverride,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
      .where(
        and(
          eq(invoices.customerPaymentStatus, "unpaid"),
          isNotNull(invoices.dueDate),
          gte(invoices.dueDate, today),
          lte(invoices.dueDate, in7Days)
        )
      )
      .orderBy(invoices.dueDate);

    for (const row of dueSoonRows) {
      const amount = row.quantityTons * (row.sellPriceOverride ?? row.sellPrice ?? 0);
      const daysLeft = Math.ceil(
        (new Date(row.dueDate!).getTime() - Date.now()) / 86400000
      );
      results.push({
        id: `due-soon-${row.id}`,
        type: "due_soon",
        severity: "warning",
        title: `Due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}: ${row.invoiceNumber}`,
        description: `${row.clientName ?? "Unknown"} — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        link: "/payments",
        date: row.dueDate,
      });
    }
  } catch {
    // skip silently
  }

  // ── 3. Stale shipments (active, no update in 5+ days) ────────────────────
  try {
    const staleRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        lastLocationUpdate: invoices.lastLocationUpdate,
        currentLocation: invoices.currentLocation,
        shipmentStatus: invoices.shipmentStatus,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
      .where(
        and(
          ne(invoices.shipmentStatus, "entregado"),
          ne(invoices.shipmentStatus, "programado"),
          or(
            isNull(invoices.lastLocationUpdate),
            lt(invoices.lastLocationUpdate, ago5Days)
          )
        )
      )
      .orderBy(invoices.lastLocationUpdate);

    for (const row of staleRows) {
      const daysSince = row.lastLocationUpdate
        ? Math.floor((Date.now() - new Date(row.lastLocationUpdate).getTime()) / 86400000)
        : null;
      results.push({
        id: `stale-${row.id}`,
        type: "stale_shipment",
        severity: "info",
        title: `No update: ${row.invoiceNumber}`,
        description: `${row.clientName ?? "Unknown"} — ${row.currentLocation ?? "Location unknown"} — ${
          daysSince != null ? `${daysSince} days since last update` : "Never updated"
        }`,
        link: "/invoices",
        date: row.lastLocationUpdate,
      });
    }
  } catch {
    // skip silently
  }

  // ── 4. Pending scheduled reports (due today or overdue) ──────────────────
  try {
    const pendingReportRows = await db
      .select({
        id: scheduledReports.id,
        sendDate: scheduledReports.sendDate,
        clientName: clients.name,
        templateName: reportTemplates.name,
      })
      .from(scheduledReports)
      .leftJoin(reportTemplates, eq(scheduledReports.templateId, reportTemplates.id))
      .leftJoin(clients, eq(scheduledReports.clientId, clients.id))
      .where(
        and(
          eq(scheduledReports.status, "pending"),
          lte(scheduledReports.sendDate, today)
        )
      )
      .orderBy(scheduledReports.sendDate);

    for (const row of pendingReportRows) {
      results.push({
        id: `report-${row.id}`,
        type: "pending_report",
        severity: "warning",
        title: `Report due: ${row.templateName ?? "Report"}`,
        description: `${row.clientName ?? "Unknown"} — scheduled for ${row.sendDate}`,
        link: "/reports",
        date: row.sendDate,
      });
    }
  } catch {
    // table may not exist in this environment — skip silently
  }

  // ── 5. Proposals expiring in 7 days ──────────────────────────────────────
  try {
    const expiringRows = await db
      .select({
        id: proposals.id,
        proposalNumber: proposals.proposalNumber,
        validUntil: proposals.validUntil,
        clientName: clients.name,
        title: proposals.title,
      })
      .from(proposals)
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .where(
        and(
          eq(proposals.status, "sent"),
          isNotNull(proposals.validUntil),
          gte(proposals.validUntil, today),
          lte(proposals.validUntil, in7Days)
        )
      )
      .orderBy(proposals.validUntil);

    for (const row of expiringRows) {
      const daysLeft = Math.ceil(
        (new Date(row.validUntil!).getTime() - Date.now()) / 86400000
      );
      results.push({
        id: `proposal-${row.id}`,
        type: "proposal_expiring",
        severity: "warning",
        title: `Proposal expiring: ${row.proposalNumber}`,
        description: `${row.clientName ?? "Unknown"} — expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        link: `/proposals/${row.id}`,
        date: row.validUntil,
      });
    }
  } catch {
    // table may not exist in this environment — skip silently
  }

  // ── 6. Important upcoming dates (audit, etc.) ─────────────────────────────
  for (const kd of KEY_DATES) {
    const days = Math.ceil((new Date(kd.date + "T00:00:00").getTime() - Date.now()) / 86400000);
    if (days < 0 || days > 120) continue; // surface within ~4 months
    results.push({
      id: `keydate-${kd.id}`,
      type: "key_date",
      severity: days <= 7 ? "critical" : days <= 30 ? "warning" : "info",
      title: `${kd.label} in ${days} day${days !== 1 ? "s" : ""}`,
      description: `${kd.note ? kd.note + " · " : ""}${kd.date}`,
      link: kd.link,
      date: kd.date,
    });
  }

  // ── 7. Certificate expiries within 90 days ────────────────────────────────
  const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];
  try {
    const certRows = await db
      .select({ id: certificates.id, name: certificates.name, code: certificates.certCode, validUntil: certificates.validUntil })
      .from(certificates)
      .where(and(isNotNull(certificates.validUntil), gte(certificates.validUntil, today), lte(certificates.validUntil, in90Days)));
    for (const r of certRows) {
      const days = Math.ceil((new Date(r.validUntil!).getTime() - Date.now()) / 86400000);
      results.push({
        id: `cert-${r.id}`,
        type: "cert_expiry",
        severity: days <= 30 ? "critical" : "warning",
        title: `Certificate expiring: ${r.name ?? r.code ?? "Certificate"}`,
        description: `${r.code ?? ""} — expires in ${days} day${days !== 1 ? "s" : ""} (${r.validUntil})`,
        link: "/certificates",
        date: r.validUntil,
      });
    }
  } catch { /* skip silently */ }

  try {
    const custCertRows = await db
      .select({ id: customerCertificates.id, scheme: customerCertificates.scheme, number: customerCertificates.certificateNumber, expiry: customerCertificates.expiryDate, clientName: clients.name })
      .from(customerCertificates)
      .leftJoin(clients, eq(customerCertificates.clientId, clients.id))
      .where(and(isNotNull(customerCertificates.expiryDate), gte(customerCertificates.expiryDate, today), lte(customerCertificates.expiryDate, in90Days)));
    for (const r of custCertRows) {
      const days = Math.ceil((new Date(r.expiry!).getTime() - Date.now()) / 86400000);
      results.push({
        id: `custcert-${r.id}`,
        type: "cert_expiry",
        severity: days <= 30 ? "critical" : "warning",
        title: `Customer cert expiring: ${r.clientName ?? "Customer"}`,
        description: `${(r.scheme ?? "").toUpperCase()} ${r.number ?? ""} — expires in ${days} day${days !== 1 ? "s" : ""}`,
        link: "/reports/audit-export",
        date: r.expiry,
      });
    }
  } catch { /* skip silently */ }

  // ── 8. Recent client-portal logins (last 3 days) ──────────────────────────
  try {
    const ago3Days = new Date(Date.now() - 3 * 86400000).toISOString();
    const logins = await db
      .select({ id: activityLog.id, userName: activityLog.userName, label: activityLog.entityLabel, at: activityLog.createdAt })
      .from(activityLog)
      .where(and(eq(activityLog.action, "login"), eq(activityLog.entity, "portal"), gte(activityLog.createdAt, ago3Days)))
      .orderBy(desc(activityLog.createdAt))
      .limit(15);
    for (const l of logins) {
      results.push({
        id: `portal-login-${l.id}`,
        type: "portal_login",
        severity: "info",
        title: `Portal access: ${l.userName ?? "Someone"}`,
        description: `${l.label ?? "Client"} signed in to their portal`,
        link: "/activity",
        date: l.at ? l.at.split("T")[0] : null,
      });
    }
  } catch { /* skip silently */ }

  return results;
}
