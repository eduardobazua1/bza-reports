/**
 * BZA Document Processor — Cascade Pacific Pulp
 *
 * Usage:
 *   node scripts/process-docs.mjs <pdf-path>
 *
 * Example:
 *   node scripts/process-docs.mjs ~/Downloads/ShipDoc.pdf
 *
 * What it does:
 *   1. Reads the combined PDF (COA + BOL + Tally Sheet per car)
 *   2. Classifies each page by text content
 *   3. Extracts per-car data: vehicle #, BOL #, bales, destination
 *   4. Matches each car to its TMS invoice by air-dry metric tons
 *   5. Splits into separate files: BOL, PL, COA
 *   6. Saves all files to iCloud Drive / BOLS CASCADE
 *   7. Updates TMS invoice fields (vehicle, BOL#, bales, destination)
 *   8. Uploads BOL + PL to TMS
 */

import fs from "fs";
import path from "path";
import os from "os";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────
const ICLOUD   = path.join(os.homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");
const SAVE_DIR = path.join(ICLOUD, "BOLS CASCADE");
const TMS_URL  = "http://localhost:3000";

// Ship To city keywords → TMS destination label
// Add more entries here as new destinations come up
const DESTINATION_MAP = {
  "SAN JUAN DEL RIO": "Bajio",
  "QUERETARO":        "Bajio",
  "MONTERREY":        "Monterrey",
  "GUADALAJARA":      "Guadalajara",
  "ZAPOPAN":          "Guadalajara",
  "PUEBLA":           "Puebla",
  "TOLUCA":           "Toluca",
  "ECATEPEC":         "CDMX",
  "CUAUTITLAN":       "CDMX",
  "LERMA":            "Toluca",
  "MANZANILLO":       "Manzanillo",
  "VERACRUZ":         "Veracruz",
  "LAREDO":           "Laredo",
};

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
  }
}
loadEnv();

// ─── PDF Text Extraction ──────────────────────────────────────────────────────
async function extractPageText(pdfDoc, pageIndex) {
  // Save single page as buffer, then parse with pdfjs
  const singleDoc = await PDFDocument.create();
  const [copied] = await singleDoc.copyPages(pdfDoc, [pageIndex]);
  singleDoc.addPage(copied);
  const bytes = await singleDoc.save();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
}

// ─── Page Type Detection ──────────────────────────────────────────────────────
function detectPageType(text) {
  const t = text.toUpperCase();
  if (t.includes("CERTIFICATE OF ANALYSIS")) return "coa";
  if (t.includes("BILL OF LADING"))          return "bol";
  if (t.includes("TALLY SHEET"))             return "pl";
  // Tally continuation pages: rows of "316S 2330902xxxx 3,xxx HALSEY 6"
  if (/\b316[A-Z]\s+\d{11}\s+[\d,]+\s+HALSEY/.test(t)) return "pl";
  return "other";
}

// ─── Data Extraction ──────────────────────────────────────────────────────────
function extractCoaData(text) {
  // COA table header pattern: "Car Number Air Dry Metric Tons [TYPE] [NUM] [MT]"
  // Example: "Car Number Air Dry Metric Tons LRS 141109 90.900"
  //          "Car Number Air Dry Metric Tons TBOX 670600 89.334"
  const carMtMatch = text.match(/Car\s+Number\s+Air\s+Dry\s+Metric\s+Tons\s+([A-Z]+)\s+(\d+)\s+([\d.]+)/i);

  // Bale/Unit count: "378 / 63" that appears after "Bale / Unit Count"
  const baleMatch  = text.match(/Bale\s*\/\s*Unit\s*Count.*?(\d+)\s*\/\s*(\d+)/is);

  // Order number suffix: "HS074117-002" → 2
  const orderMatch = text.match(/HS\d+-(\d+)/);

  return {
    vehicle:     carMtMatch ? `${carMtMatch[1]}${carMtMatch[2]}` : null,   // TBOX670600
    airDryMt:    carMtMatch ? parseFloat(carMtMatch[3])           : null,   // 90.900
    bales:       baleMatch  ? parseInt(baleMatch[1])              : null,   // 378
    units:       baleMatch  ? parseInt(baleMatch[2])              : null,   // 63
    orderSuffix: orderMatch ? parseInt(orderMatch[1])             : null,   // 1
  };
}

function extractPlData(texts) {
  // Combine all PL pages (tally sheet may span 2 pages)
  const combined = texts.join(" ");

  // Bales per unit: each tally row ends with "HALSEY 6" (the 6 = bales/unit)
  // Take the first match — it's consistent throughout
  const balesPerUnitMatch = combined.match(/HALSEY\s+(\d+)/);
  const balesPerUnit = balesPerUnitMatch ? parseInt(balesPerUnitMatch[1]) : null;

  // Total units: "63 Total Number of Units Total Weight LOAD TOTALS"
  const totalUnitsMatch = combined.match(/(\d+)\s+Total\s+Number\s+of\s+Units/i);
  const totalUnits = totalUnitsMatch ? parseInt(totalUnitsMatch[1]) : null;

  // Total bales = units × balesPerUnit
  const totalBales = totalUnits && balesPerUnit ? totalUnits * balesPerUnit : null;

  return { balesPerUnit, totalUnits, totalBales };
}

function extractBolData(text) {
  // Car No: "Car No. LRS 141109"  or  "Car No. TBOX 670600"
  const carMatch  = text.match(/Car\s+No\.\s+([A-Z]+)\s+(\d+)/);
  const vehicle   = carMatch ? `${carMatch[1]}${carMatch[2]}` : null;   // No space: TBOX670600

  // Shipment # → BOL number
  const shipMatch = text.match(/Shipment\s*#\s*(\d+)/);
  const bolNumber = shipMatch ? shipMatch[1] : null;

  // PO number: "Marks X0007" or standalone "X0007"
  const poMatch   = text.match(/\b(X\d{4})\b/);
  const poNumber  = poMatch ? poMatch[1] : null;

  // Ship To → destination  (text looks like: "Ship To: ... CITY STATE, MEXICO")
  // Grab up to ~300 chars after "Ship To:" and check against destination map
  const shipToIdx = text.search(/Ship\s+To:/i);
  let destination = null;
  if (shipToIdx !== -1) {
    const shipToText = text.slice(shipToIdx, shipToIdx + 300).toUpperCase();
    for (const [keyword, label] of Object.entries(DESTINATION_MAP)) {
      if (shipToText.includes(keyword)) {
        destination = label;
        break;
      }
    }
  }

  return { vehicle, bolNumber, poNumber, destination };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const [,, inputArg] = process.argv;
  if (!inputArg) {
    console.error("Usage: node scripts/process-docs.mjs <pdf-path>");
    console.error("Example: node scripts/process-docs.mjs ~/Downloads/ShipDoc.pdf");
    process.exit(1);
  }

  const inputPath = inputArg.replace(/^~/, os.homedir());
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`\n📄 Processing: ${path.basename(inputPath)}`);

  fs.mkdirSync(SAVE_DIR, { recursive: true });

  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc   = await PDFDocument.load(pdfBytes);
  const total    = pdfDoc.getPageCount();
  console.log(`📑 Total pages: ${total}\n`);

  // ── Step 1: classify every page ──────────────────────────────
  console.log("🔍 Classifying pages...");
  const pages = [];
  for (let i = 0; i < total; i++) {
    const text = await extractPageText(pdfDoc, i);
    const type = detectPageType(text);
    pages.push({ index: i, type, text });
    console.log(`  Page ${i + 1}: ${type.toUpperCase().padEnd(5)}  ${text.slice(0, 60).replace(/\n/g, " ")}...`);
  }

  // ── Step 2: group into cars (each COA starts a new car) ──────
  const cars = [];
  let current = null;
  for (const p of pages) {
    if (p.type === "coa") {
      if (current) cars.push(current);
      current = { coa: [p.index], bol: [], pl: [] };
    } else if (current) {
      if (p.type === "bol") current.bol.push(p.index);
      else if (p.type === "pl") current.pl.push(p.index);
      else current.pl.push(p.index); // treat unknown as PL
    }
  }
  if (current) cars.push(current);

  console.log(`\n✂️  Found ${cars.length} car(s) — saving BOL + PL only (COA skipped)\n`);

  // ── Step 3: connect to DB ─────────────────────────────────────
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL || "file:sqlite.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // ── Step 4: process each car ──────────────────────────────────
  const results = [];

  for (let ci = 0; ci < cars.length; ci++) {
    const car = cars[ci];
    console.log(`\n── Car ${ci + 1} of ${cars.length} ─────────────────────────────`);

    // Extract data
    const coaText  = pages.find(p => p.index === car.coa[0])?.text || "";
    const bolText  = pages.find(p => p.index === car.bol[0])?.text || "";
    const plTexts  = car.pl.map(idx => pages.find(p => p.index === idx)?.text || "");
    const coaData  = extractCoaData(coaText);
    const bolData  = extractBolData(bolText);
    const plData   = extractPlData(plTexts);

    // Vehicle comes from COA (cleaner format); BOL as fallback
    const vehicle = coaData.vehicle || bolData.vehicle;

    console.log(`  Vehicle:     ${vehicle               || "❓ not found"}`);
    console.log(`  BOL #:       ${bolData.bolNumber    || "❓ not found"}`);
    console.log(`  PO:          ${bolData.poNumber     || "❓ not found"}`);
    console.log(`  Destination: ${bolData.destination  || "❓ not found"}`);
    console.log(`  Air Dry MT:  ${coaData.airDryMt     || "❓ not found"}`);
    console.log(`  Units:       ${plData.totalUnits    || "❓ not found"}`);
    console.log(`  Bales/unit:  ${plData.balesPerUnit  || "❓ not found"}`);
    console.log(`  Total bales: ${plData.totalBales    || "❓ not found"}`);

    const poNumber = bolData.poNumber;

    // Match invoice by MT
    let invoiceId   = null;
    let invoiceNum  = null;
    if (poNumber && coaData.airDryMt) {
      const res = await client.execute({
        sql: `SELECT inv.id, inv.invoice_number
              FROM invoices inv
              JOIN purchase_orders po ON po.id = inv.purchase_order_id
              WHERE po.po_number = ?
                AND ROUND(inv.quantity_tons, 3) = ROUND(?, 3)
              LIMIT 1`,
        args: [poNumber, coaData.airDryMt],
      });
      if (res.rows.length > 0) {
        invoiceId  = Number(res.rows[0].id);
        invoiceNum = String(res.rows[0].invoice_number);
        console.log(`  ✅ Matched → ${invoiceNum} (ID ${invoiceId})`);
      } else {
        console.warn(`  ⚠️  No invoice matched for PO ${poNumber} with ${coaData.airDryMt} MT`);
      }
    }

    const label = invoiceNum || `${poNumber || "DOC"}-${ci + 1}`;

    // ── Save files ──────────────────────────────────────────────
    async function savePdf(pageIndices, prefix) {
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(pdfDoc, pageIndices);
      copied.forEach(p => newDoc.addPage(p));
      const bytes    = await newDoc.save();
      const fileName = `${prefix} ${label}.pdf`;
      const outPath  = path.join(SAVE_DIR, fileName);
      fs.writeFileSync(outPath, bytes);
      console.log(`  💾 Saved: ${fileName}`);
      return { fileName, bytes, outPath };
    }

    const bolFile = car.bol.length > 0 ? await savePdf(car.bol, "BOL") : null;
    const plFile  = car.pl.length  > 0 ? await savePdf(car.pl,  "PL")  : null;

    results.push({ label, invoiceId, invoiceNum, vehicle, bolData, coaData, plData, bolFile, plFile });
  }

  // ── Step 5: update TMS invoices + upload files ────────────────
  console.log("\n⬆️  Updating TMS...\n");

  for (const r of results) {
    if (!r.invoiceId) {
      console.log(`  ⏭  ${r.label}: skipped (no invoice match)`);
      continue;
    }

    // Update invoice fields directly in DB
    try {
      await client.execute({
        sql: `UPDATE invoices
              SET vehicle_id    = COALESCE(?, vehicle_id),
                  bl_number     = COALESCE(?, bl_number),
                  bales_count   = COALESCE(?, bales_count),
                  units_per_bale = COALESCE(?, units_per_bale),
                  destination   = COALESCE(?, destination),
                  updated_at    = datetime('now')
              WHERE id = ?`,
        args: [
          r.vehicle                  || null,
          r.bolData.bolNumber        || null,
          r.plData.totalBales        || null,
          r.plData.balesPerUnit      || null,
          r.bolData.destination      || null,
          r.invoiceId,
        ],
      });
      console.log(`  ✅ ${r.invoiceNum}: vehicle=${r.vehicle}, BOL#=${r.bolData.bolNumber}, bales=${r.plData.totalBales} (${r.plData.totalUnits} units × ${r.plData.balesPerUnit}), dest=${r.bolData.destination}`);
    } catch (e) {
      console.warn(`  ⚠️  ${r.invoiceNum}: DB update failed — ${e.message}`);
    }

    const authHeaders = { "x-internal-key": process.env.INTERNAL_API_KEY || "" };

    // Upload BOL to TMS
    if (r.bolFile) {
      try {
        const blob = new Blob([r.bolFile.bytes], { type: "application/pdf" });
        const fd   = new FormData();
        fd.append("invoiceId", String(r.invoiceId));
        fd.append("type", "bl");
        fd.append("file", blob, r.bolFile.fileName);
        const res = await fetch(`${TMS_URL}/api/documents`, { method: "POST", headers: authHeaders, body: fd });
        if (res.ok) console.log(`  ✅ ${r.bolFile.fileName} → TMS`);
        else        console.warn(`  ⚠️  BOL upload failed: ${res.status} ${await res.text()}`);
      } catch (e) {
        console.warn(`  ⚠️  Could not reach TMS: ${e.message}`);
      }
    }

    // Upload PL to TMS
    if (r.plFile) {
      try {
        const blob = new Blob([r.plFile.bytes], { type: "application/pdf" });
        const fd   = new FormData();
        fd.append("invoiceId", String(r.invoiceId));
        fd.append("type", "pl");
        fd.append("file", blob, r.plFile.fileName);
        const res = await fetch(`${TMS_URL}/api/documents`, { method: "POST", headers: authHeaders, body: fd });
        if (res.ok) console.log(`  ✅ ${r.plFile.fileName} → TMS`);
        else        console.warn(`  ⚠️  PL upload failed: ${res.status} ${await res.text()}`);
      } catch (e) {
        console.warn(`  ⚠️  Could not reach TMS: ${e.message}`);
      }
    }
  }

  client.close();

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n🎉 Done!\n");
  console.log("📋 Summary:");
  for (const r of results) {
    const status = r.invoiceId ? `→ ${r.invoiceNum}` : "⚠️  no match";
    console.log(`   ${r.label.padEnd(12)} ${status}  vehicle=${r.vehicle || "?"}  BOL#=${r.bolData.bolNumber || "?"}  dest=${r.bolData.destination || "?"}`);
  }
  console.log(`\n📁 Files saved to: ${SAVE_DIR}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
