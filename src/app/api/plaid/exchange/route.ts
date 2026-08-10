import { NextRequest, NextResponse } from "next/server";
import { plaidClient, mapAccountType } from "@/lib/plaid";
import { db } from "@/db";
import { plaidItems, bankAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Exchanges the public_token (from Plaid Link) for a permanent access_token,
// stores the item, and creates a bank_account row for each linked account.
export async function POST(req: NextRequest) {
  const { public_token, institution } = await req.json().catch(() => ({}));
  if (!public_token) return NextResponse.json({ error: "public_token required" }, { status: 400 });

  try {
    const client = plaidClient();
    const ex = await client.itemPublicTokenExchange({ public_token });
    const accessToken = ex.data.access_token;
    const itemId = ex.data.item_id;

    const [item] = await db.insert(plaidItems)
      .values({ itemId, accessToken, institution: institution ?? null })
      .returning();

    const acc = await client.accountsGet({ access_token: accessToken });
    let created = 0;
    for (const a of acc.data.accounts) {
      const existing = await db.query.bankAccounts.findFirst({ where: eq(bankAccounts.plaidAccountId, a.account_id) });
      if (existing) continue;
      await db.insert(bankAccounts).values({
        name: a.name,
        bank: institution ?? "Bank",
        accountNumberMasked: `XXX${a.mask ?? ""}`,
        accountType: mapAccountType(a.subtype),
        currency: a.balances.iso_currency_code ?? "USD",
        openingBalance: a.balances.current ?? 0,
        openingDate: new Date().toISOString().slice(0, 10),
        plaidItemId: item.id,
        plaidAccountId: a.account_id,
      });
      created++;
    }
    return NextResponse.json({ ok: true, accounts: created, institution: institution ?? null });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    return NextResponse.json({ error: err.response?.data ?? err.message ?? "exchange failed" }, { status: 500 });
  }
}
