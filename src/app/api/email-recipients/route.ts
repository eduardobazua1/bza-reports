import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceEmailLogs, invoices, purchaseOrders, clients, reportEmailLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Quick-win email address book (no extra tables): mines the send history so the
// user never has to look recipients up in their mail again.
//   - `addresses`: every email address ever used (To + CC), de-duplicated — for autocomplete.
//   - `last`: the most recent { to, cc } used for the SAME client as `invoiceNumber` (if given),
//             so "Use last recipients" fills the whole list in one click, even for a brand-new invoice.
export async function GET(req: NextRequest) {
  const invoiceNumber = req.nextUrl.searchParams.get("invoiceNumber");
  const clientIdParam = req.nextUrl.searchParams.get("clientId");

  const logs = await db
    .select({
      sentTo: invoiceEmailLogs.sentTo,
      sentCc: invoiceEmailLogs.sentCc,
      sentAt: invoiceEmailLogs.sentAt,
      clientId: purchaseOrders.clientId,
    })
    .from(invoiceEmailLogs)
    .leftJoin(invoices, eq(invoiceEmailLogs.invoiceId, invoices.id))
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .orderBy(desc(invoiceEmailLogs.sentAt));

  // De-duplicate every address ever used (case-insensitive), keep first-seen casing.
  const seen = new Map<string, string>();
  const add = (raw: string | null) => {
    if (!raw) return;
    for (const part of raw.split(/[,;]/)) {
      const e = part.trim();
      if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !seen.has(e.toLowerCase())) {
        seen.set(e.toLowerCase(), e);
      }
    }
  };
  for (const l of logs) { add(l.sentTo); add(l.sentCc); }

  // Fold in client-report send history (has clientId directly).
  const rlogs = await db
    .select({ sentTo: reportEmailLogs.sentTo, sentCc: reportEmailLogs.sentCc, sentAt: reportEmailLogs.sentAt, clientId: reportEmailLogs.clientId })
    .from(reportEmailLogs)
    .orderBy(desc(reportEmailLogs.sentAt));
  for (const l of rlogs) { add(l.sentTo); add(l.sentCc); }

  // Also fold in saved client contact emails so they autocomplete too.
  const clientRows = await db.select({ email: clients.contactEmail }).from(clients);
  for (const c of clientRows) add(c.email);

  // Last recipients used for a given client — resolved from either clientId or an invoiceNumber.
  let last: { to: string; cc: string | null } | null = null;
  let clientId: number | null = clientIdParam ? Number(clientIdParam) : null;
  if (clientId == null && invoiceNumber) {
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });
    if (inv) {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, inv.purchaseOrderId) });
      clientId = po?.clientId ?? null;
    }
  }
  if (clientId != null && !Number.isNaN(clientId)) {
    // Most recent recipients for this client across BOTH invoice and report sends.
    const invMatch = logs.find((l) => l.clientId === clientId);
    const repMatch = rlogs.find((l) => l.clientId === clientId);
    const cands = [
      invMatch ? { to: invMatch.sentTo, cc: invMatch.sentCc, at: invMatch.sentAt } : null,
      repMatch ? { to: repMatch.sentTo, cc: repMatch.sentCc, at: repMatch.sentAt } : null,
    ].filter(Boolean) as { to: string; cc: string | null; at: string }[];
    cands.sort((a, b) => (a.at < b.at ? 1 : -1));
    if (cands[0]) last = { to: cands[0].to, cc: cands[0].cc };
  }

  return NextResponse.json({ addresses: Array.from(seen.values()).sort((a, b) => a.localeCompare(b)), last });
}
