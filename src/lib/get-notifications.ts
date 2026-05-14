import { db } from "@/db";
import { invoices, purchaseOrders, clients, scheduledReports, reportTemplates, proposals } from "@/db/schema";
import { and, eq, lt, lte, gte, ne, or, isNull, isNotNull } from "drizzle-orm";

export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationType =
  | "overdue"
  | "due_soon"
  | "stale_shipment"
  | "pending_report"
  | "proposal_expiring";

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

  return results;
}
