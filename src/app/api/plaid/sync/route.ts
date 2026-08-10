import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { db } from "@/db";
import { plaidItems, bankAccounts, bankTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Pulls new/changed transactions from Plaid for every connected item and
// upserts them into bank_transactions. Uses Plaid's incremental cursor.
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured." }, { status: 400 });
  }
  try {
    const client = plaidClient();
    const items = await db.select().from(plaidItems);
    let added = 0, removed = 0;

    for (const item of items) {
      const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.plaidItemId, item.id));
      const acctMap = new Map(accts.map((a) => [a.plaidAccountId, a.id] as const));

      let cursor = item.cursor ?? undefined;
      let hasMore = true;
      while (hasMore) {
        const r = await client.transactionsSync({ access_token: item.accessToken, cursor });
        for (const t of r.data.added) {
          const baId = acctMap.get(t.account_id);
          if (!baId) continue;
          const exists = await db.select({ id: bankTransactions.id }).from(bankTransactions).where(eq(bankTransactions.plaidTransactionId, t.transaction_id)).limit(1);
          if (exists.length) continue;
          const plaidCat = t.personal_finance_category?.primary ?? null;
          await db.insert(bankTransactions).values({
            bankAccountId: baId,
            plaidTransactionId: t.transaction_id,
            transactionDate: t.date,
            amount: -1 * t.amount, // Plaid: +out/-in → TMS signed: +credit/-debit
            descriptionRaw: t.name,
            vendorName: t.merchant_name ?? null,
            category: "Uncategorized",
            notes: plaidCat ? `Plaid category: ${plaidCat}` : null,
            importedFrom: "plaid",
          });
          added++;
        }
        for (const t of r.data.removed) {
          if (!t.transaction_id) continue;
          await db.delete(bankTransactions).where(eq(bankTransactions.plaidTransactionId, t.transaction_id));
          removed++;
        }
        cursor = r.data.next_cursor;
        hasMore = r.data.has_more;
      }
      await db.update(plaidItems).set({ cursor: cursor ?? null }).where(eq(plaidItems.id, item.id));
    }
    return NextResponse.json({ ok: true, added, removed, items: items.length });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    return NextResponse.json({ error: err.response?.data ?? err.message ?? "sync failed" }, { status: 500 });
  }
}
