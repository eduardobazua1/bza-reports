import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceEmailLogs, invoices, purchaseOrders, clients } from "@/db/schema";
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
    // logs are already sorted newest-first; take the first one for this client
    const match = logs.find((l) => l.clientId === clientId);
    if (match) last = { to: match.sentTo, cc: match.sentCc };
  }

  return NextResponse.json({ addresses: Array.from(seen.values()).sort((a, b) => a.localeCompare(b)), last });
}
