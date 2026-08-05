import { db } from "@/db";
import { invoices, purchaseOrders, clients, certificates, customerCertificates } from "@/db/schema";
import { eq, and, isNotNull, lt, inArray, sql } from "drizzle-orm";

// Proactive business alerts for the dashboard cockpit — the system surfaces what
// needs attention instead of the user having to go looking.

export type AlertItem = { label: string; sub?: string; href: string; value?: string };
export type AlertGroup = { key: string; title: string; count: number; severity: "high" | "medium"; href: string; items: AlertItem[] };

const CERT_WINDOW_DAYS = 60;
const STALE_DAYS = 7;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

export async function getAlerts(): Promise<{ groups: AlertGroup[]; total: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const certCutoff = new Date(Date.now() + CERT_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const [overdue, bzaCerts, custCerts, stale] = await Promise.all([
    // Overdue customer invoices: unpaid and past due date.
    db.select({
      invoiceNumber: invoices.invoiceNumber,
      dueDate: invoices.dueDate,
      tons: invoices.quantityTons,
      sellOverride: invoices.sellPriceOverride,
      poSell: purchaseOrders.sellPrice,
      clientName: clients.name,
    })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
      .where(and(eq(invoices.customerPaymentStatus, "unpaid"), isNotNull(invoices.dueDate), lt(invoices.dueDate, today))),
    // BZA certificates expiring within the window.
    db.select({ code: certificates.certCode, type: certificates.certType, validUntil: certificates.validUntil })
      .from(certificates)
      .where(and(isNotNull(certificates.validUntil), lt(certificates.validUntil, certCutoff))),
    // Customer certificates expiring within the window.
    db.select({ scheme: customerCertificates.scheme, expiry: customerCertificates.expiryDate, clientName: clients.name })
      .from(customerCertificates)
      .leftJoin(clients, eq(customerCertificates.clientId, clients.id))
      .where(and(isNotNull(customerCertificates.expiryDate), lt(customerCertificates.expiryDate, certCutoff))),
    // In-transit shipments with no location update in a while.
    db.select({ invoiceNumber: invoices.invoiceNumber, dest: invoices.destination, lastUpd: invoices.lastLocationUpdate })
      .from(invoices)
      .where(and(inArray(invoices.shipmentStatus, ["en_transito", "en_aduana"]),
        sql`(${invoices.lastLocationUpdate} is null or ${invoices.lastLocationUpdate} < ${staleCutoff})`)),
  ]);

  const groups: AlertGroup[] = [];

  if (overdue.length) {
    const items = overdue
      .map((r) => {
        const price = r.sellOverride ?? r.poSell ?? 0;
        const amount = (r.tons || 0) * price;
        const days = r.dueDate ? daysBetween(today, r.dueDate) : 0;
        return { label: r.invoiceNumber, sub: `${r.clientName || "—"} · ${days}d overdue`, href: "/invoices?status=unpaid", value: amount, days };
      })
      .sort((a, b) => b.days - a.days);
    groups.push({
      key: "overdue", title: "Overdue invoices", count: items.length, severity: "high", href: "/invoices?status=unpaid",
      items: items.slice(0, 8).map((i) => ({ label: i.label, sub: i.sub, href: i.href, value: i.value ? usd(i.value) : undefined })),
    });
  }

  const certItems: AlertItem[] = [
    ...bzaCerts.map((c) => ({ label: `BZA ${(c.type || "").toUpperCase()} ${c.code || ""}`.trim(), sub: `expires ${c.validUntil}`, href: "/certificates" })),
    ...custCerts.map((c) => ({ label: `${c.clientName || "Customer"} · ${(c.scheme || "").toUpperCase()}`, sub: `expires ${c.expiry}`, href: "/reports/audit-export" })),
  ];
  if (certItems.length) groups.push({ key: "certs", title: "Certificates expiring soon", count: certItems.length, severity: "high", href: "/certificates", items: certItems.slice(0, 8) });

  if (stale.length) {
    groups.push({
      key: "stale", title: "Shipments without recent update", count: stale.length, severity: "medium", href: "/reports/shipments",
      items: stale.slice(0, 8).map((r) => ({ label: r.invoiceNumber, sub: `${r.dest || "—"} · no update ${r.lastUpd ? `since ${r.lastUpd.slice(0, 10)}` : "logged"}`, href: "/reports/shipments" })),
    });
  }

  return { groups, total: groups.reduce((n, g) => n + g.count, 0) };
}

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
