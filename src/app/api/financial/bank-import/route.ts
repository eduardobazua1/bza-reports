import { NextResponse } from "next/server";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { parseVantageCsv } from "@/lib/financial/parse-vantage-csv";
import { loadRules, categorize } from "@/lib/financial/categorize";

/**
 * POST /api/financial/bank-import
 * multipart/form-data: file (CSV), bankAccountId
 * OR application/json: { bankAccountId, csv }
 *
 * Parses, categorizes, dedupes, and inserts bank transactions.
 */
export async function POST(req: Request) {
  let bankAccountId: number;
  let csv: string;
  let filename = "manual";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    bankAccountId = Number(form.get("bankAccountId"));
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    csv = await file.text();
    filename = file.name;
  } else {
    const body = await req.json();
    bankAccountId = Number(body.bankAccountId);
    csv = body.csv;
  }

  if (!bankAccountId || !csv) {
    return NextResponse.json({ error: "bankAccountId and CSV content required" }, { status: 400 });
  }

  const parsed = parseVantageCsv(csv);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No rows parsed", details: parsed.errors }, { status: 400 });
  }

  const rules = await loadRules();

  // Load existing transactions for this account to dedupe (date + amount + description)
  const existing = await db
    .select({
      date: bankTransactions.transactionDate,
      amount: bankTransactions.amount,
      desc: bankTransactions.descriptionRaw,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.bankAccountId, bankAccountId));
  const existingKeys = new Set(
    existing.map((e) => `${e.date}|${e.amount}|${e.desc}`)
  );

  const toInsert: typeof bankTransactions.$inferInsert[] = [];
  let skipped = 0;
  const categoryCounts: Record<string, number> = {};
  let uncategorized = 0;

  for (const row of parsed.rows) {
    const key = `${row.transactionDate}|${row.amount}|${row.descriptionRaw}`;
    if (existingKeys.has(key)) { skipped++; continue; }
    existingKeys.add(key); // dedupe within file too

    const cat = categorize(row.descriptionRaw, rules);
    categoryCounts[cat.category] = (categoryCounts[cat.category] || 0) + 1;
    if (cat.category === "Uncategorized") uncategorized++;

    toInsert.push({
      bankAccountId,
      transactionDate: row.transactionDate,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      descriptionRaw: row.descriptionRaw,
      vendorName: cat.vendorName,
      category: cat.category,
      subcategory: cat.subcategory,
      manuallyCategorized: false,
      importedFrom: filename,
    });
  }

  if (toInsert.length > 0) {
    // Insert in chunks to avoid SQL var limits
    const chunkSize = 200;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      await db.insert(bankTransactions).values(toInsert.slice(i, i + chunkSize));
    }
  }

  return NextResponse.json({
    imported: toInsert.length,
    skippedDuplicates: skipped,
    uncategorized,
    categoryBreakdown: categoryCounts,
    parseErrors: parsed.errors,
    accountNumbersInFile: parsed.accountNumbers,
  });
}
