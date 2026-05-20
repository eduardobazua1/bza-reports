/**
 * BZA Document Processor
 *
 * Usage:
 *   node scripts/process-docs.mjs <pdf-path> <invoice-number>
 *
 * Example:
 *   node scripts/process-docs.mjs ~/Desktop/shipment.pdf IX0001-1
 *
 * What it does:
 *   1. Reads the combined PDF (BOL + PL + COA)
 *   2. Detects each page type by text content
 *   3. Splits into separate files
 *   4. Saves to ~/Documents/BZA/Cascade/{BOLs|PLs|COAs}/
 *   5. Uploads each to the TMS via localhost:3000
 */

import fs from "fs";
import path from "path";
import os from "os";
import { PDFDocument } from "pdf-lib";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_DIR = path.join(os.homedir(), "Documents", "BZA", "Cascade");
const FOLDERS = {
  bl:    path.join(BASE_DIR, "BOLs"),
  pl:    path.join(BASE_DIR, "PLs"),
  coa:   path.join(BASE_DIR, "COAs"),
  other: path.join(BASE_DIR, "Other"),
};
const TMS_URL = "http://localhost:3000";

// Load .env.local for Turso credentials
function loadEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...rest] = line.split("=");
    if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
  }
}
loadEnv();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectType(text) {
  const t = text.toUpperCase();
  if (t.includes("BILL OF LADING") || t.includes("B/L NO") || t.includes("RAILROAD BILL") || t.includes("WAYBILL")) return "bl";
  if (t.includes("PACKING LIST") || t.includes("PACK LIST") || t.includes("LISTA DE EMPAQUE")) return "pl";
  if (t.includes("CERTIFICATE OF ANALYSIS") || t.includes("CERT OF ANALYSIS") || t.includes("CERTIFICATE OF QUALITY") || t.includes("COA")) return "coa";
  return "other";
}

function typeLabel(type) {
  return { bl: "BOL", pl: "PL", coa: "COA", other: "DOC" }[type] || "DOC";
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const [,, inputPath, invoiceNumber] = process.argv;

  if (!inputPath || !invoiceNumber) {
    console.error("Usage: node scripts/process-docs.mjs <pdf-path> <invoice-number>");
    console.error("Example: node scripts/process-docs.mjs ~/Desktop/shipment.pdf IX0001-1");
    process.exit(1);
  }

  const resolvedPath = inputPath.replace(/^~/, os.homedir());
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`\n📄 Processing: ${path.basename(resolvedPath)}`);
  console.log(`📋 Invoice: ${invoiceNumber}\n`);

  // Create output folders
  Object.values(FOLDERS).forEach(f => fs.mkdirSync(f, { recursive: true }));

  // Read PDF bytes
  const pdfBytes = fs.readFileSync(resolvedPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  console.log(`📑 Total pages: ${totalPages}`);

  // Extract text per page to detect document type
  const pageTypes = [];
  for (let i = 0; i < totalPages; i++) {
    // Extract single page to text
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(pdfDoc, [i]);
    singleDoc.addPage(copiedPage);
    const singleBytes = await singleDoc.save();

    try {
      const parsed = await pdfParse(Buffer.from(singleBytes));
      const type = detectType(parsed.text);
      pageTypes.push(type);
      console.log(`  Page ${i + 1}: ${typeLabel(type)} — "${parsed.text.slice(0, 60).replace(/\n/g, " ").trim()}..."`);
    } catch {
      pageTypes.push("other");
      console.log(`  Page ${i + 1}: OTHER (could not parse)`);
    }
  }

  // Group consecutive pages of same type
  const groups = [];
  let current = { type: pageTypes[0], pages: [0] };
  for (let i = 1; i < totalPages; i++) {
    if (pageTypes[i] === current.type) {
      current.pages.push(i);
    } else {
      groups.push(current);
      current = { type: pageTypes[i], pages: [i] };
    }
  }
  groups.push(current);

  console.log(`\n✂️  Splitting into ${groups.length} document(s):\n`);

  // Look up invoice in Turso to get numeric ID
  let invoiceId = null;
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:sqlite.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const result = await client.execute({
      sql: "SELECT id FROM invoices WHERE invoice_number = ?",
      args: [invoiceNumber],
    });
    if (result.rows.length > 0) {
      invoiceId = Number(result.rows[0].id);
      console.log(`🔍 Found invoice ID: ${invoiceId} for ${invoiceNumber}\n`);
    } else {
      console.warn(`⚠️  Invoice "${invoiceNumber}" not found in database — files will be saved locally only.\n`);
    }
    client.close();
  } catch (e) {
    console.warn(`⚠️  Could not connect to database: ${e.message}\n`);
  }

  const savedFiles = [];

  for (const group of groups) {
    const label = typeLabel(group.type);
    const fileName = `${label} ${invoiceNumber}.pdf`;
    const outputDir = FOLDERS[group.type] || FOLDERS.other;
    const outputPath = path.join(outputDir, fileName);

    // Extract pages for this group
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(pdfDoc, group.pages);
    copiedPages.forEach(p => newDoc.addPage(p));
    const outBytes = await newDoc.save();

    fs.writeFileSync(outputPath, outBytes);
    console.log(`  ✅ ${fileName} (${group.pages.length} page${group.pages.length > 1 ? "s" : ""}) → ${outputPath}`);

    savedFiles.push({ type: group.type, label, fileName, outputPath, bytes: outBytes });
  }

  // Upload to TMS
  if (invoiceId) {
    console.log(`\n⬆️  Uploading to TMS (invoice ID ${invoiceId})...\n`);
    for (const { type, label, fileName, bytes } of savedFiles) {
      if (type === "coa") {
        console.log(`  ⏭  Skipping ${fileName} (COA not stored in TMS)`);
        continue;
      }
      try {
        const blob = new Blob([bytes], { type: "application/pdf" });
        const fd = new FormData();
        fd.append("invoiceId", String(invoiceId));
        fd.append("type", type);
        fd.append("file", blob, fileName);

        const res = await fetch(`${TMS_URL}/api/documents`, { method: "POST", body: fd });
        if (res.ok) {
          console.log(`  ✅ ${fileName} uploaded to TMS`);
        } else {
          const err = await res.json().catch(() => ({}));
          console.warn(`  ⚠️  ${fileName} upload failed: ${err.error || res.status}`);
        }
      } catch (e) {
        console.warn(`  ⚠️  Could not reach TMS at ${TMS_URL}: ${e.message}`);
      }
    }
  }

  console.log(`\n🎉 Done!\n`);
  console.log(`📁 Files saved to:`);
  savedFiles.forEach(({ outputPath }) => console.log(`   ${outputPath}`));
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
