import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

/** GET /api/financial/transactions?accountId=&category=&from=&to= */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conds = [];
  if (accountId) conds.push(eq(bankTransactions.bankAccountId, Number(accountId)));
  if (category) conds.push(eq(bankTransactions.category, category as never));
  if (from) conds.push(gte(bankTransactions.transactionDate, from));
  if (to) conds.push(lte(bankTransactions.transactionDate, to));

  const rows = await db
    .select()
    .from(bankTransactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(bankTransactions.transactionDate))
    .limit(1000);

  return NextResponse.json(rows);
}

/** PATCH /api/financial/transactions  { id, category, subcategory, vendorName } */
export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, category, subcategory, vendorName } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [updated] = await db
    .update(bankTransactions)
    .set({
      ...(category ? { category } : {}),
      subcategory: subcategory ?? null,
      vendorName: vendorName ?? null,
      manuallyCategorized: true,
    })
    .where(eq(bankTransactions.id, Number(id)))
    .returning();

  return NextResponse.json(updated);
}
