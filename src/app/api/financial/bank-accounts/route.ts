import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankAccounts, bankTransactions } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await db.select().from(bankAccounts).orderBy(desc(bankAccounts.isActive));
  const sums = await db
    .select({ bankAccountId: bankTransactions.bankAccountId, net: sql<number>`coalesce(sum(${bankTransactions.amount}), 0)` })
    .from(bankTransactions)
    .groupBy(bankTransactions.bankAccountId);
  const netById = new Map(sums.map((s) => [s.bankAccountId, Number(s.net)]));
  const withBalance = accounts.map((a) => ({ ...a, currentBalance: Number(a.openingBalance) + (netById.get(a.id) ?? 0) }));
  return NextResponse.json(withBalance);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, bank, accountNumberMasked, accountType, currency, openingBalance, openingDate, notes } = body;
  if (!name || !bank || !accountNumberMasked || !accountType || !openingDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const [account] = await db
    .insert(bankAccounts)
    .values({
      name, bank, accountNumberMasked, accountType,
      currency: currency || "USD",
      openingBalance: openingBalance ?? 0,
      openingDate,
      notes: notes || null,
    })
    .returning();
  return NextResponse.json(account, { status: 201 });
}
