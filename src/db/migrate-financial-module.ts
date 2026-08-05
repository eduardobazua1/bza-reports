/**
 * Apply the financial module schema (bank_accounts, bank_transactions,
 * operating_expenses, capital_movements, accounting_periods, period_snapshots,
 * transaction_category_rules) to local SQLite and optionally Turso.
 *
 * Safe to re-run: all statements use IF NOT EXISTS.
 *
 * Run: npx tsx src/db/migrate-financial-module.ts
 */
import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

const SQL_PATH = path.join(__dirname, "migrations", "0009_financial_module.sql");

async function migrate(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  const sql = fs.readFileSync(SQL_PATH, "utf-8");
  // Split on Drizzle's --> statement-breakpoint marker; ignore SQL line comments
  const statements = sql
    .split(/--> statement-breakpoint/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") || s.includes("CREATE"));

  let applied = 0;
  for (const stmt of statements) {
    const trimmed = stmt
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (!trimmed) continue;
    try {
      await client.execute(trimmed);
      const firstLine = trimmed.split("\n")[0].slice(0, 100);
      console.log(`  ✓ ${firstLine}`);
      applied++;
    } catch (err) {
      console.error(`  ✗ Failed: ${trimmed.slice(0, 100)}`);
      console.error(`    ${err}`);
      throw err;
    }
  }
  console.log(`✓ Applied ${applied} statements`);

  // Seed the default category rules — the auto-categorization patterns we already validated
  await seedDefaultRules(client);

  await client.close();
}

async function seedDefaultRules(client: ReturnType<typeof createClient>) {
  const existing = await client.execute("SELECT COUNT(*) as n FROM transaction_category_rules");
  const count = Number(existing.rows[0]?.n ?? 0);
  if (count > 0) {
    console.log(`  ℹ Skipping seed: transaction_category_rules already has ${count} rows`);
    return;
  }

  // Priority order: higher number = checked first
  // Bank fees MUST come before customer/supplier name matches because fee descriptions
  // often contain the counterparty name (e.g. "WIRE FEE BIO PAPPEL ...")
  const rules: Array<[string, string, string | null, string | null, number]> = [
    // Internal transfers — highest priority
    ["108145069", "Internal Transfer", "Between Accounts", null, 1000],
    ["107945161", "Internal Transfer", "Between Accounts", null, 1000],
    ["TRANSFER FROM 5069", "Internal Transfer", "Between Accounts", null, 1000],
    ["TRANSFER TO 5069", "Internal Transfer", "Between Accounts", null, 1000],
    ["TRANSFER FROM 5161", "Internal Transfer", "Between Accounts", null, 1000],
    ["TRANSFER TO 5161", "Internal Transfer", "Between Accounts", null, 1000],
    ["XFER TO CHECKING", "Internal Transfer", "Between Accounts", null, 1000],
    ["XFER FROM CHECKING", "Internal Transfer", "Between Accounts", null, 1000],
    ["XFER TO MONEY MARKET", "Internal Transfer", "Between Accounts", null, 1000],
    ["XFER FROM MONEY MARKET", "Internal Transfer", "Between Accounts", null, 1000],
    // Bank fees — before counterparty names
    ["WIRE FEE", "OpEx", "Wire Fees", null, 900],
    ["FX FEE", "OpEx", "Wire Fees", null, 900],
    ["SERVICE CHARGE", "OpEx", "Bank Service Charges", null, 900],
    ["ACCOUNT ANALYSIS", "OpEx", "Bank Service Charges", null, 900],
    ["MONTHLY MAINTENANCE", "OpEx", "Bank Service Charges", null, 900],
    ["NOTICE OF FREEZE", "OpEx", "Bank Service Charges", null, 900],
    ["OVERDRAFT", "OpEx", "Overdraft & NSF Fees", null, 900],
    ["INTEREST ON OVERDRAFT", "OpEx", "Overdraft & NSF Fees", null, 950],
    // Interest income (must come AFTER "INTEREST ON OVERDRAFT")
    ["INTEREST", "Other Income", "Interest Income", null, 800],
    // Capital
    ["CREA INVESTMENTS", "Capital", "Capital Contribution — CREA", "CREA Investments BZA LLC", 800],
    ["VMA SPV", "Capital", "Capital Contribution — VMA SPV 1", "VMA SPV 1 LLC", 800],
    // Personal / distributions
    ["CAPITAL ONE", "Distribution", "Personal CC Payment", "Capital One CC", 700],
    ["JESUS EDUARDO BAZUA", "Distribution", "Owner Distribution — Jesús Bazua", "Jesús E. Bazua", 700],
    ["JESUS E. BAZUA", "Distribution", "Owner Distribution — Jesús Bazua", "Jesús E. Bazua", 700],
    ["JESUS BAZUA", "Distribution", "Owner Distribution — Jesús Bazua", "Jesús E. Bazua", 700],
    ["VICTOR BAZUA", "Distribution", "Owner Distribution — Victor Bazua", "Victor Bazua", 700],
    ["LUZ MARIA", "Distribution", "Personal/Family", null, 700],
    ["CRYSTAL STORIES", "Distribution", "Personal/Family", null, 700],
    ["SOFIA GIL", "Distribution", "Personal/Family", null, 700],
    ["FRANGOS", "Distribution", "Personal/Family", null, 700],
    ["INTERCAM", "Distribution", "Personal — Intercam MX Account", null, 700],
    ["GENNARO CATALDO", "Distribution", "Personal/Family — Spouse Business", null, 700],
    ["SERENA TARALLO", "Distribution", "Personal/Family — Spouse Business", null, 700],
    ["SESTO CONTINENTE", "Distribution", "Personal/Family — Spouse Business", null, 700],
    ["JULIA & LOREN", "Distribution", "Personal/Family — Spouse Business", null, 700],
    ["JULIA LOREN", "Distribution", "Personal/Family — Spouse Business", null, 700],
    ["RICHEMONT", "Distribution", "Personal — Luxury Purchase", null, 700],
    ["BRAVO COLLECTION", "Distribution", "Personal — Bravo Collection", null, 700],
    ["COACHELLA", "Distribution", "Personal — Coachella", null, 700],
    ["ACH ORIGINATED CREDIT RETURN", "Distribution", "Personal — Refund", null, 700],
    ["BZA INTERNATIONA ACH", "Distribution", "Personal — ACH Payment", null, 700],
    ["BILLINGFEE CKFXXXXX5097POS", "Distribution", "Personal CC Billing Fee", null, 700],
    // Customers (Revenue)
    ["OPERADORA FALCON", "Revenue", "Sales — Biopappel via Falcon", "Biopappel S.A. de C.V.", 500],
    ["KIMBERLY CLARK", "Revenue", "Sales — Kimberly Clark", "Kimberly-Clark de México S.A.B. de C.V.", 500],
    ["KIMBERLY-CLARK", "Revenue", "Sales — Kimberly Clark", "Kimberly-Clark de México S.A.B. de C.V.", 500],
    ["BIO PAPPEL", "Revenue", "Sales — Bio Pappel", "Biopappel S.A. de C.V.", 500],
    ["BIOPAPPEL", "Revenue", "Sales — Bio Pappel", "Biopappel S.A. de C.V.", 500],
    ["GRUPO CORPORATIVO PAPELERA", "Revenue", "Sales — Grupo Corp Papelera", "Grupo Corporativo Papelera S.A. de C.V.", 500],
    ["COPAMEX", "Revenue", "Sales — Copamex", "Copamex Industrias S.A. de C.V.", 500],
    ["SANITATE", "Revenue", "Sales — Sanitate", "Sanitate S. de R.L. de C.V.", 500],
    ["PAPELERA DE CHIHUAHUA", "Revenue", "Sales — Papelera de Chihuahua", "Papelera de Chihuahua S.A. de C.V.", 500],
    // Suppliers (COGS)
    ["CELULOSA ARAUCO", "COGS", "Pulp Purchases — Arauco", "Celulosa Arauco", 500],
    ["ARAUCO", "COGS", "Pulp Purchases — Arauco", "Celulosa Arauco", 500],
    ["CASCADE PACIFIC PULP", "COGS", "Pulp Purchases — Cascade Pacific", "Cascade Pacific Pulp", 500],
    ["APP CHINA", "COGS", "Pulp Purchases — APP China", "APP of China", 500],
    ["APP TRADING", "COGS", "Pulp Purchases — APP China", "APP of China", 500],
    ["SUZANO", "COGS", "Pulp Purchases — Suzano", "Suzano", 500],
    // OpEx — Commissions
    ["DIMSA", "OpEx", "Commissions — DIMSA", "DIMSA Solutions", 500],
    ["SALVADOR SASSON", "OpEx", "Commissions — Salvador Sasson", "Salvador Sasson", 500],
    ["DESAROLLOS TECNOLOGIC", "OpEx", "Commissions — Desarollos Tecnologic", "Desarollos Tecnologic", 500],
    ["DESARROLLOS TECNOLOGIC", "OpEx", "Commissions — Desarollos Tecnologic", "Desarollos Tecnologic", 500],
    // OpEx — Other vendors
    ["DRAGE CPA", "OpEx", "Professional Services — Accounting", "Drage CPA PLLC", 500],
    ["EULER HERMES", "OpEx", "Credit Insurance (Allianz/Euler Hermes)", "Allianz Trade / Euler Hermes", 500],
    ["GOOLETS", "OpEx", "Logistics — Goolets", "Goolets d.o.o.", 500],
  ];

  const now = new Date().toISOString();
  for (const [pattern, category, subcategory, vendor, priority] of rules) {
    await client.execute({
      sql: `INSERT INTO transaction_category_rules
              (pattern, match_type, category, subcategory, vendor_name, default_reconcile_type, priority, active, created_at)
            VALUES (?, 'contains', ?, ?, ?, 'none', ?, true, ?)`,
      args: [pattern, category, subcategory, vendor, priority, now],
    });
  }
  console.log(`  ✓ Seeded ${rules.length} default categorization rules`);
}

(async () => {
  console.log("→ Applying financial_module migration to local SQLite (file:sqlite.db)...");
  await migrate("file:sqlite.db");

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl && tursoToken) {
    console.log(`\n→ Applying to Turso (${tursoUrl})...`);
    await migrate(tursoUrl, tursoToken);
  } else {
    console.log("\n(Turso credentials not set — skipping remote apply)");
  }
  console.log("\n✓ Done.");
})().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
