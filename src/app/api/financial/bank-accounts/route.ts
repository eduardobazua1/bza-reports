import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankAccounts } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const accounts = await db.select().from(bankAccounts).orderBy(desc(bankAccounts.isActive));
  return NextResponse.json(accounts);
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
