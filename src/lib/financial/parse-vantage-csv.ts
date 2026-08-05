/**
 * Parse a Vantage Bank Texas transaction CSV export.
 *
 * Expected header (BOM-prefixed): Account,ChkRef,Debit,Credit,Balance,Date,Description
 * - Debit  = money out (we store as negative amount)
 * - Credit = money in  (we store as positive amount)
 * - Date   = M/D/YYYY  (normalized to YYYY-MM-DD)
 */

export interface ParsedBankRow {
  accountNumberRaw: string;
  transactionDate: string;   // YYYY-MM-DD
  amount: number;            // signed
  balanceAfter: number | null;
  descriptionRaw: string;
}

export interface ParseResult {
  rows: ParsedBankRow[];
  errors: string[];
  accountNumbers: string[];  // distinct account numbers found
}

function normalizeDate(s: string): string | null {
  const t = s.trim();
  // M/D/YYYY or MM/DD/YYYY
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

function num(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Minimal CSV line splitter that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseVantageCsv(content: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedBankRow[] = [];
  const accountSet = new Set<string>();

  // Strip BOM
  const text = content.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["Empty file"], accountNumbers: [] };

  // Map header
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    account: header.indexOf("account"),
    debit: header.indexOf("debit"),
    credit: header.indexOf("credit"),
    balance: header.indexOf("balance"),
    date: header.indexOf("date"),
    description: header.indexOf("description"),
  };
  if (idx.date === -1 || idx.description === -1 || (idx.debit === -1 && idx.credit === -1)) {
    return {
      rows, accountNumbers: [],
      errors: [`Unexpected header. Got: ${header.join(", ")}. Expected Account,ChkRef,Debit,Credit,Balance,Date,Description`],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const dateStr = cols[idx.date] ?? "";
    const date = normalizeDate(dateStr);
    if (!date) {
      errors.push(`Row ${i + 1}: bad date "${dateStr}"`);
      continue;
    }
    const debit = idx.debit >= 0 ? num(cols[idx.debit] ?? "") : null;
    const credit = idx.credit >= 0 ? num(cols[idx.credit] ?? "") : null;
    let amount: number;
    if (credit != null && credit !== 0) amount = Math.abs(credit);
    else if (debit != null && debit !== 0) amount = -Math.abs(debit);
    else { amount = 0; }

    const account = (cols[idx.account] ?? "").trim();
    if (account) accountSet.add(account);

    rows.push({
      accountNumberRaw: account,
      transactionDate: date,
      amount: Math.round(amount * 100) / 100,
      balanceAfter: idx.balance >= 0 ? num(cols[idx.balance] ?? "") : null,
      descriptionRaw: (cols[idx.description] ?? "").trim(),
    });
  }

  return { rows, errors, accountNumbers: Array.from(accountSet) };
}
