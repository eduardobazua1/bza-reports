import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured, decryptToken } from "@/lib/plaid";
import { db } from "@/db";
import { plaidItems, bankAccounts, bankTransactions, transactionCategoryRules } from "@/db/schema";
import { eq } from "drizzle-orm";

// Categorize a bank transaction description with the saved rules (case-insensitive
// "contains", highest priority wins). Falls back to Uncategorized.
type Rule = { pattern: string; category: string; subcategory: string | null; priority: number };
function categorize(desc: string, rules: Rule[]): { category: string; subcategory: string | null } {
  const d = (desc || "").toLowerCase();
  for (const r of rules) if (r.pattern && d.includes(r.pattern.toLowerCase())) return { category: r.category, subcategory: r.subcategory };
  return { category: "Uncategorized", subcategory: null };
}

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
    const rules = (await db.select({ pattern: transactionCategoryRules.pattern, category: transactionCategoryRules.category, subcategory: transactionCategoryRules.subcategory, priority: transactionCategoryRules.priority })
      .from(transactionCategoryRules).where(eq(transactionCategoryRules.active, true)))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)) as Rule[];
    let added = 0, removed = 0;

    for (const item of items) {
      const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.plaidItemId, item.id));
      const acctMap = new Map(accts.map((a) => [a.plaidAccountId, a.id] as const));

      const accessToken = decryptToken(item.accessToken);
      let cursor = item.cursor ?? undefined;
      let hasMore = true;
      while (hasMore) {
        const r = await client.transactionsSync({ access_token: accessToken, cursor });
        for (const t of r.data.added) {
          const baId = acctMap.get(t.account_id);
          if (!baId) continue;
          const exists = await db.select({ id: bankTransactions.id }).from(bankTransactions).where(eq(bankTransactions.plaidTransactionId, t.transaction_id)).limit(1);
          if (exists.length) continue;
          const plaidCat = t.personal_finance_category?.primary ?? null;
          const { category, subcategory } = categorize(t.name, rules);
          await db.insert(bankTransactions).values({
            bankAccountId: baId,
            plaidTransactionId: t.transaction_id,
            transactionDate: t.date,
            amount: -1 * t.amount, // Plaid: +out/-in → TMS signed: +credit/-debit
            descriptionRaw: t.name,
            vendorName: t.merchant_name ?? null,
            category,
            subcategory,
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
    const err = e as { response?: { data?: { error_code?: string; error_message?: string; display_message?: string } }; message?: string };
    const d = err.response?.data;
    const msg = d
      ? [d.error_code, d.display_message || d.error_message].filter(Boolean).join(": ") || JSON.stringify(d)
      : (err.message ?? "sync failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
