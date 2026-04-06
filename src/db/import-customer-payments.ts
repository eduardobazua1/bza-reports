/**
 * Import historical customer payments from QuickBooks "Invoices and Received Payments" PDF.
 * Cash → Wire Transfer (per user note)
 * Run: npx tsx src/db/import-customer-payments.ts
 */
import { createClient } from "@libsql/client";

type PaymentRow = {
  clientName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  invoices: { invoiceNumber: string; amount: number }[];
};

// Normalize OCR errors: "IXOO" (letter O) → "IX00" (zero)
function norm(n: string) {
  return n.replace(/IXOO/g, "IX00");
}

const PAYMENTS: PaymentRow[] = [
  // ─── Papelera de Chihuahua ────────────────────────────────────────────────
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-06-29",
    amount: 171686.85,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0001-1", amount: 85279.60 },
      { invoiceNumber: "IX0001-2", amount: 86407.25 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-08-23",
    amount: 179747.08,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0002-1", amount: 90900.08 },
      { invoiceNumber: "IX0002-2", amount: 88847.00 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-09-30",
    amount: 102297.20,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0003-1", amount: 102297.20 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-08-29",
    amount: 188810.13,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0002-3", amount: 94529.60 },
      { invoiceNumber: "IX0002-4", amount: 94280.53 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-10-03",
    amount: 205268.92,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0003-2", amount: 101953.01 },
      { invoiceNumber: "IX0003-3", amount: 103315.91 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-10-28",
    amount: 217017.80,
    paymentMethod: "cv_credit",
    invoices: [
      { invoiceNumber: "IX0004-1", amount: 108219.85 },
      { invoiceNumber: "IX0004-2", amount: 108797.95 },
    ],
  },
  {
    clientName: "Papelera de Chihuahua, S.A. De C.V.",
    paymentDate: "2022-11-18",
    amount: 97521.48,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0004-3", amount: 97521.48 },
    ],
  },
  // ─── Copamex ──────────────────────────────────────────────────────────────
  {
    clientName: "Copamex Industrias, S.A. De C.V.",
    paymentDate: "2022-12-07",
    amount: 107024.88,
    paymentMethod: "cv_credit",
    invoices: [
      { invoiceNumber: "IX0005-1-3", amount: 107024.88 },
    ],
  },
  {
    clientName: "Copamex Industrias, S.A. De C.V.",
    paymentDate: "2022-12-06",
    amount: 106294.03,
    paymentMethod: "cv_credit",
    invoices: [
      { invoiceNumber: "IX0005-1-2", amount: 106294.03 },
    ],
  },
  {
    clientName: "Copamex Industrias, S.A. De C.V.",
    paymentDate: "2022-11-03",
    amount: 97130.20,
    paymentMethod: "cv_credit",
    invoices: [
      { invoiceNumber: "IX0005-1-1", amount: 97130.20 },
    ],
  },
  // ─── Kimberly Clark de México S.A.B. De C.V. ─────────────────────────────
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2023-07-05",
    amount: 452123.11,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0007-1", amount: 64993.50 },
      { invoiceNumber: "IX0007-2", amount: 63873.81 },
      { invoiceNumber: "IX0007-3", amount: 64340.71 },
      { invoiceNumber: "IX0007-4", amount: 65268.78 },
      { invoiceNumber: "IX0007-5", amount: 65365.30 },
      { invoiceNumber: "IX0007-6", amount: 65662.74 },
      { invoiceNumber: "IX0007-7", amount: 64081.16 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2023-07-18",
    amount: 129633.79,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0007-8", amount: 63902.41 },
      { invoiceNumber: "IX0007-9", amount: 64268.49 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2023-08-30",
    amount: 117713.70,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0009-1", amount: 59167.55 },
      { invoiceNumber: "IX0009-2", amount: 58546.15 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2023-09-05",
    amount: 294459.75,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0009-3", amount: 58791.20 },
      { invoiceNumber: "IX0009-4", amount: 59373.60 },
      { invoiceNumber: "IX0009-5", amount: 58403.80 },
      { invoiceNumber: "IX0009-6", amount: 58858.15 },
      { invoiceNumber: "IX0009-7", amount: 59033.00 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-07-29",
    amount: 292432.80,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0024-1", amount: 71181.60 },
      { invoiceNumber: "IX0024-2", amount: 74536.80 },
      { invoiceNumber: "IX0024-3", amount: 74359.20 },
      { invoiceNumber: "IX0024-4", amount: 72355.20 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-08-04",
    amount: 146681.60,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0024-5", amount: 72098.40 },
      { invoiceNumber: "IX0024-6", amount: 74583.20 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-09-17",
    amount: 148622.40,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0027-1", amount: 74282.40 },
      { invoiceNumber: "IX0027-2", amount: 74340.00 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-09-19",
    amount: 218095.20,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0027-3", amount: 72992.80 },
      { invoiceNumber: "IX0027-4", amount: 73352.00 },
      { invoiceNumber: "IX0027-5", amount: 71750.40 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-09-29",
    amount: 71964.80,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0027-6", amount: 71964.80 },
    ],
  },
  // ─── Kimberly-Clark de México S.A.B. De C.V. (second QB entity) ──────────
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2023-11-16",
    amount: 319405.54,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0010-1", amount: 52922.87 },
      { invoiceNumber: "IX0010-2", amount: 52813.39 },
      { invoiceNumber: "IX0010-3", amount: 53201.93 },
      { invoiceNumber: "IX0010-4", amount: 54214.62 },
      { invoiceNumber: "IX0010-5", amount: 53013.91 },
      { invoiceNumber: "IX0010-6", amount: 53238.82 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2024-07-16",
    amount: 31200.00,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0016", amount: 31200.00 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-10-16",
    amount: 74872.20,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0028-1", amount: 74872.20 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-10-24",
    amount: 145624.44,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0028-2", amount: 73528.26 },
      { invoiceNumber: "IX0028-3", amount: 72096.18 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-10-30",
    amount: 142676.04,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0028-4", amount: 71401.98 },
      { invoiceNumber: "IX0028-5", amount: 71274.06 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-11-04",
    amount: 143339.82,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0028-6", amount: 71387.94 },
      { invoiceNumber: "IX0028-7", amount: 71951.88 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-11-28",
    amount: 209938.19,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0030-1", amount: 70054.60 },
      { invoiceNumber: "IX0030-2", amount: 69664.98 },
      { invoiceNumber: "IX0030-3", amount: 70218.61 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-09-18",
    amount: 350760.37,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0030-4", amount: 69415.50 },
      { invoiceNumber: "IX0030-5", amount: 71676.22 },
      { invoiceNumber: "IX0030-6", amount: 71111.04 },
      { invoiceNumber: "IX0033-3", amount: 68489.07 },
      { invoiceNumber: "IX0033-4", amount: 70309.38 },
      { invoiceNumber: "IX0033-5", amount: 68248.23 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2025-12-30",
    amount: 205534.41,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0033-1", amount: 68350.15 },
      { invoiceNumber: "IX0033-2", amount: 68695.19 },
      { invoiceNumber: "IX0033-6", amount: 66067.03 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-01-16",
    amount: 202155.03,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0033-7", amount: 69099.11 },
      { invoiceNumber: "IX0033-8", amount: 66988.89 },
      { invoiceNumber: "IX0034-4", amount: 68543.24 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-01-29",
    amount: 201356.96,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0034-2", amount: 68012.66 },
      { invoiceNumber: "IX0034-3", amount: 64801.06 },
      { invoiceNumber: "IX0034-1", amount: 69917.42 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-02-18",
    amount: 205967.90,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0034-6", amount: 67610.10 },
      { invoiceNumber: "IX0034-9", amount: 66308.44 },
      { invoiceNumber: "IX0034-10", amount: 68440.38 },
      { invoiceNumber: "IX0034-11", amount: 68003.78 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-02-20",
    amount: 338701.70,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0034-5", amount: 67918.68 },
      { invoiceNumber: "IX0034-7", amount: 67696.68 },
      { invoiceNumber: "IX0034-8", amount: 68774.12 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-03-18",
    amount: 195557.76,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0038-1", amount: 64445.76 },
      { invoiceNumber: "IX0038-3", amount: 65216.16 },
      { invoiceNumber: "IX0038-2", amount: 65895.84 },
    ],
  },
  {
    clientName: "Kimberly-Clark de México S.A.B. De C.V.",
    paymentDate: "2026-03-20",
    amount: 265778.64,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0038-4", amount: 66710.88 },
      { invoiceNumber: "IX0038-5", amount: 66817.44 },
      { invoiceNumber: "IX0038-6", amount: 67008.24 },
      { invoiceNumber: "IX0038-7", amount: 65242.08 },
    ],
  },
  // ─── Sanitate ─────────────────────────────────────────────────────────────
  {
    clientName: "Sanitate S. De R.L. De C.V.",
    paymentDate: "2023-04-27",
    amount: 70008.40,
    paymentMethod: "wire_transfer",
    referenceNo: "1423435",
    invoices: [
      { invoiceNumber: "IX0008", amount: 70008.40 },
    ],
  },
  // ─── Biopappel Scribe ─────────────────────────────────────────────────────
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2023-11-29",
    amount: 1215911.60,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0011", amount: 305001.60 },
      { invoiceNumber: "IX0012-1", amount: 456092.00 },
      { invoiceNumber: "IX0012-2", amount: 454818.00 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-02-12",
    amount: 1029834.00,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0013-1", amount: 343278.00 },
      { invoiceNumber: "IX0013-2", amount: 343278.00 },
      { invoiceNumber: "IX0013-3", amount: 343278.00 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-03-13",
    amount: 682670.70,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0013-4", amount: 335356.20 },
      { invoiceNumber: "IX0014-1", amount: 347314.50 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-03-15",
    amount: 347314.50,
    paymentMethod: "biopappel_scribe",
    invoices: [
      { invoiceNumber: "IX0014-2", amount: 347314.50 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-04-09",
    amount: 659897.56,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0014-3", amount: 329948.78 },
      { invoiceNumber: "IX0014-4", amount: 329948.78 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-05-03",
    amount: 347511.58,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0015-1", amount: 347511.58 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-05-31",
    amount: 1001539.89,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0015-2", amount: 345452.23 },
      { invoiceNumber: "IX0015-3", amount: 656087.66 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-06-21",
    amount: 2033008.03,
    paymentMethod: "factoraje_bbva",
    invoices: [
      { invoiceNumber: "IX0015-4", amount: 655096.80 },
      { invoiceNumber: "IX0017-1", amount: 107157.18 },
      { invoiceNumber: "IX0017-2", amount: 212797.20 },
      { invoiceNumber: "IX0017-3", amount: 353039.33 },
      { invoiceNumber: "IX0017-4", amount: 353039.33 },
      { invoiceNumber: "IX0017-5", amount: 351878.19 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-07-26",
    amount: 1974839.50,
    paymentMethod: "factoraje_bbva",
    invoices: [
      { invoiceNumber: "IX0017-6", amount: 351885.24 },
      { invoiceNumber: "IX0017-7", amount: 423666.28 },
      { invoiceNumber: "IX0020-1", amount: 423720.62 },
      { invoiceNumber: "IX0020-2", amount: 351807.69 },
      { invoiceNumber: "IX0020-3", amount: 423759.67 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-10-09",
    amount: 867602.44,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0020-4", amount: 434637.06 },
      { invoiceNumber: "IX0020-5", amount: 432965.38 },
    ],
  },
  {
    clientName: "Biopappel Scribe, S.A. de C.V.",
    paymentDate: "2024-11-14",
    amount: 2149412.07,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0020-6", amount: 434195.58 },
      { invoiceNumber: "IX0021-1", amount: 457344.42 },
      { invoiceNumber: "IX0021-2", amount: 457344.42 },
      { invoiceNumber: "IX0021-3", amount: 458743.74 },
      { invoiceNumber: "IX0021-4", amount: 341783.91 },
    ],
  },
  // ─── Biopappel S.A. de C.V. ───────────────────────────────────────────────
  {
    clientName: "Biopappel S.A. de C.V.",
    paymentDate: "2025-07-31",
    amount: 1107210.20,
    paymentMethod: "factoraje_bbva",
    invoices: [
      { invoiceNumber: "IX0025-1", amount: 368710.92 },
      { invoiceNumber: "IX0025-2", amount: 369615.20 },
      { invoiceNumber: "IX0025-3", amount: 368884.08 },
    ],
  },
  {
    clientName: "Biopappel S.A. de C.V.",
    paymentDate: "2025-08-28",
    amount: 738065.64,
    paymentMethod: "xepellin",
    invoices: [
      { invoiceNumber: "IX0026-1", amount: 369345.84 },
      { invoiceNumber: "IX0026-2", amount: 368719.80 },
    ],
  },
  {
    clientName: "Biopappel S.A. de C.V.",
    paymentDate: "2025-09-26",
    amount: 369717.32,
    paymentMethod: "factoraje_bbva",
    invoices: [
      { invoiceNumber: "IX0026-3", amount: 369717.32 },
    ],
  },
  {
    clientName: "Biopappel S.A. de C.V.",
    paymentDate: "2025-12-01",
    amount: 711470.41,
    paymentMethod: "biopappel_scribe",
    invoices: [
      { invoiceNumber: "IX0029-1", amount: 356431.36 },
      { invoiceNumber: "IX0029-2", amount: 355039.05 },
    ],
  },
  {
    clientName: "Biopappel S.A. de C.V.",
    paymentDate: "2025-12-24",
    amount: 1235394.02,
    paymentMethod: "factoraje_bbva",
    invoices: [
      { invoiceNumber: "IX0032-1", amount: 308927.40 },
      { invoiceNumber: "IX0032-2", amount: 308927.40 },
      { invoiceNumber: "IX0032-3", amount: 617539.22 },
    ],
  },
  // ─── Grupo Corporativo Papelera ───────────────────────────────────────────
  {
    clientName: "Grupo Corporativo Papelera S.A. DE C.V.",
    paymentDate: "2025-12-26",
    amount: 208711.06,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0031", amount: 73070.40 },
      { invoiceNumber: "IX0035-1", amount: 67508.92 },
      { invoiceNumber: "IX0035-2", amount: 68131.74 },
    ],
  },
  {
    clientName: "Grupo Corporativo Papelera S.A. DE C.V.",
    paymentDate: "2026-01-15",
    amount: 134349.20,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0037-1", amount: 66333.64 },
      { invoiceNumber: "IX0037-2", amount: 68015.56 },
    ],
  },
  {
    clientName: "Grupo Corporativo Papelera S.A. DE C.V.",
    paymentDate: "2026-03-05",
    amount: 68344.06,
    paymentMethod: "wire_transfer",
    invoices: [
      { invoiceNumber: "IX0037-3", amount: 68344.06 },
    ],
  },
];

async function run(url: string, authToken?: string) {
  const client = createClient({ url, authToken });

  // Check if already imported
  const existing = await client.execute("SELECT COUNT(*) as cnt FROM customer_payments");
  const count = (existing.rows[0] as any).cnt as number;
  if (count > 0) {
    console.log(`Already has ${count} payments, skipping import.`);
    await client.close();
    return;
  }

  // Get client name → id mapping
  const clientRows = await client.execute("SELECT id, name FROM clients");
  const clientMap = new Map<string, number>();
  for (const row of clientRows.rows) {
    const r = row as any;
    clientMap.set((r.name as string).toLowerCase().trim(), r.id as number);
  }

  // Fuzzy client lookup
  function findClientId(name: string): number | null {
    const lower = name.toLowerCase().trim();
    // Exact
    if (clientMap.has(lower)) return clientMap.get(lower)!;
    // Partial match
    for (const [k, v] of clientMap) {
      if (k.includes("kimberly") && lower.includes("kimberly")) return v;
      if (k.includes("biopappel scribe") && lower.includes("biopappel scribe")) return v;
      if (k.includes("biopappel") && lower.includes("biopappel s.a.")) return v;
      if (k.includes("papelera de chihuahua") && lower.includes("papelera de chihuahua")) return v;
      if (k.includes("copamex") && lower.includes("copamex")) return v;
      if (k.includes("sanitate") && lower.includes("sanitate")) return v;
      if (k.includes("grupo corporativo") && lower.includes("grupo corporativo")) return v;
    }
    return null;
  }

  // Get invoice number → id mapping
  const invRows = await client.execute("SELECT id, invoice_number FROM invoices");
  const invMap = new Map<string, number>();
  for (const row of invRows.rows) {
    const r = row as any;
    invMap.set((r.invoice_number as string).toUpperCase(), r.id as number);
  }

  let inserted = 0;
  let skipped = 0;

  for (const p of PAYMENTS) {
    const clientId = findClientId(p.clientName);
    if (!clientId) {
      console.warn(`  ⚠ Client not found: "${p.clientName}"`);
      skipped++;
      continue;
    }

    const result = await client.execute({
      sql: `INSERT INTO customer_payments (client_id, payment_date, amount, payment_method, reference_no) VALUES (?, ?, ?, ?, ?)`,
      args: [clientId, p.paymentDate, p.amount, p.paymentMethod, p.referenceNo ?? null],
    });
    const paymentId = Number(result.lastInsertRowid);

    for (const inv of p.invoices) {
      const normalizedNum = norm(inv.invoiceNumber).toUpperCase();
      const invoiceId = invMap.get(normalizedNum) ?? null;
      await client.execute({
        sql: `INSERT INTO customer_payment_invoices (payment_id, invoice_id, invoice_number, amount) VALUES (?, ?, ?, ?)`,
        args: [paymentId, invoiceId, norm(inv.invoiceNumber), inv.amount],
      });
    }

    inserted++;
  }

  console.log(`✓ Imported ${inserted} payments (${skipped} skipped due to unknown clients)`);
  await client.close();
}

run("file:sqlite.db")
  .then(() => {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (tursoUrl && tursoToken) {
      return run(tursoUrl, tursoToken).then(() => console.log("✓ Turso import complete"));
    } else {
      console.log("No TURSO_DATABASE_URL — skipping Turso import");
    }
  })
  .catch(console.error);
