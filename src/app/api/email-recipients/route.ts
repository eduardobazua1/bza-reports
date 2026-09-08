import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceEmailLogs, invoices, purchaseOrders, clients, reportEmailLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Email address book mined from send history.
//   - `addresses`: every address ever used (global) — for the autocomplete datalist.
//   - `clientAddresses`: addresses tied to the SELECTED client only (its send history +
//     its saved contact email). The UI shows these as chips so you never pick another
//     client's contact by mistake.
//   - `last`: the most recent { to, cc } used for that client.
export async function GET(req: NextRequest) {
  const invoiceNumber = req.nextUrl.searchParams.get("invoiceNumber");
  const clientIdParam = req.nextUrl.searchParams.get("clientId");

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const collect = (target: Map<string, string>, raw: string | null | undefined) => {
    if (!raw) return;
    for (const part of raw.split(/[,;]/)) {
      const e = part.trim();
      if (e && emailRe.test(e) && !target.has(e.toLowerCase())) target.set(e.toLowerCase(), e);
    }
  };

  const logs = await db
    .select({ sentTo: invoiceEmailLogs.sentTo, sentCc: invoiceEmailLogs.sentCc, sentAt: invoiceEmailLogs.sentAt, clientId: purchaseOrders.clientId })
    .from(invoiceEmailLogs)
    .leftJoin(invoices, eq(invoiceEmailLogs.invoiceId, invoices.id))
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .orderBy(desc(invoiceEmailLogs.sentAt));

  const rlogs = await db
    .select({ sentTo: reportEmailLogs.sentTo, sentCc: reportEmailLogs.sentCc, sentAt: reportEmailLogs.sentAt, clientId: reportEmailLogs.clientId })
    .from(reportEmailLogs)
    .orderBy(desc(reportEmailLogs.sentAt));

  // Global address book (autocomplete only).
  const seen = new Map<string, string>();
  for (const l of logs) { collect(seen, l.sentTo); collect(seen, l.sentCc); }
  for (const l of rlogs) { collect(seen, l.sentTo); collect(seen, l.sentCc); }
  const clientRows = await db.select({ id: clients.id, email: clients.contactEmail }).from(clients);
  for (const c of clientRows) collect(seen, c.email);

  // Resolve the target client.
  let clientId: number | null = clientIdParam ? Number(clientIdParam) : null;
  if (clientId == null && invoiceNumber) {
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });
    if (inv) {
      const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, inv.purchaseOrderId) });
      clientId = po?.clientId ?? null;
    }
  }

  // Client-scoped chips + last recipient.
  const clientSeen = new Map<string, string>();
  let last: { to: string; cc: string | null } | null = null;
  if (clientId != null && !Number.isNaN(clientId)) {
    for (const l of logs) if (l.clientId === clientId) { collect(clientSeen, l.sentTo); collect(clientSeen, l.sentCc); }
    for (const l of rlogs) if (l.clientId === clientId) { collect(clientSeen, l.sentTo); collect(clientSeen, l.sentCc); }
    const self = clientRows.find((c) => c.id === clientId);
    collect(clientSeen, self?.email);

    const invMatch = logs.find((l) => l.clientId === clientId);
    const repMatch = rlogs.find((l) => l.clientId === clientId);
    const cands = [
      invMatch ? { to: invMatch.sentTo, cc: invMatch.sentCc, at: invMatch.sentAt } : null,
      repMatch ? { to: repMatch.sentTo, cc: repMatch.sentCc, at: repMatch.sentAt } : null,
    ].filter(Boolean) as { to: string; cc: string | null; at: string }[];
    cands.sort((a, b) => (a.at < b.at ? 1 : -1));
    if (cands[0]) last = { to: cands[0].to, cc: cands[0].cc };
  }

  return NextResponse.json({
    addresses: Array.from(seen.values()).sort((a, b) => a.localeCompare(b)),
    clientAddresses: Array.from(clientSeen.values()).sort((a, b) => a.localeCompare(b)),
    last,
  });
}
