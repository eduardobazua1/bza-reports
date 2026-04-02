import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const DEFAULTS = {
  companyName: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  phone: "+15203317869",
  email: "accounting@bza-is.com",
  website: "www.bza-is.com",
  taxId: "32-0655438",
  primaryColor: "#0d3d3b",
  accentColor: "#4fd1c5",
  bankName: "Vantage Bank",
  bankAddress: "1705 N. 23rd St. McAllen, TX 78501",
  bankBeneficiary: "BZA International Services, LLC",
  bankAccount: "107945161",
  bankRouting: "114915272",
  bankSwift: "ITNBUS44",
  fscCode: "CU-COC-892954",
  fscCw: "CU-CW-892954",
  fscExpiration: "29-01-28",
  footerNote: "All invoice amounts are stated in USD.",
  showPaymentInstructions: true,
  showFscSection: true,
  invoiceNotes: "",
};

async function getSettings() {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "invoice") });
  if (!row) return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(row.value) }; } catch { return DEFAULTS; }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const invoiceNumber = sp.get("invoice");
  if (!invoiceNumber) return NextResponse.json({ error: "invoice param required" }, { status: 400 });

  const [inv, cfg] = await Promise.all([
    db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) }),
    getSettings(),
  ]);
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, inv.purchaseOrderId) });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const [client, supplier] = await Promise.all([
    db.query.clients.findFirst({ where: eq(clients.id, po.clientId) }),
    db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) }),
  ]);

  const price = inv.sellPriceOverride ?? po.sellPrice;
  const total = inv.quantityTons * price;
  const invoiceDate = inv.invoiceDate || inv.shipmentDate || new Date().toISOString().split("T")[0];
  const termsDays = inv.paymentTermsDays ?? client?.paymentTermsDays ?? 60;
  const dueDate = inv.dueDate || (() => {
    const d = new Date(invoiceDate + "T12:00:00");
    d.setDate(d.getDate() + termsDays);
    return d.toISOString().split("T")[0];
  })();

  const productName = inv.item || po.product || "Woodpulp";
  const supplierShortName = (supplier?.name || "").split(" ")[0];
  const inputClaim = supplier?.fscInputClaim || po.inputClaim || "";
  const productLine = [
    productName,
    inputClaim ? `${supplierShortName} FSC` : "",
    inputClaim,
  ].filter(Boolean).join("\n");

  const balesDisplay = inv.balesCount && inv.unitsPerBale
    ? `${inv.balesCount}/${inv.unitsPerBale}`
    : inv.balesCount ? String(inv.balesCount) : "";

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M = 48;       // margin
  const W = 612 - M * 2;  // content width = 516
  const TEAL  = cfg.primaryColor;   // #0d3d3b
  const CYAN  = cfg.accentColor;    // #4fd1c5
  const DARK  = "#1c1917";
  const GRAY  = "#6b7280";
  const LGRAY = "#f3f4f6";
  const RULE  = "#d1d5db";

  let y = M;  // current Y cursor (we manage it ourselves)

  // ── CYAN TOP BAR ─────────────────────────────────────────
  doc.rect(0, 0, 612, 3).fill(CYAN);

  // ── LOGO ─────────────────────────────────────────────────
  // "BZA" in teal, "." in cyan — measure BZA width before drawing
  doc.fontSize(20).font("Helvetica-Bold");
  const bzaW = doc.widthOfString("BZA");
  doc.fillColor(TEAL).text("BZA", M, y, { continued: true, lineBreak: false });
  doc.fillColor(CYAN).text(".", { lineBreak: false });

  // ── COMPANY INFO (right-aligned block) ───────────────────
  const INFO_X = 380;
  const INFO_W = 612 - M - INFO_X;
  doc.fontSize(7).font("Helvetica").fillColor(GRAY);
  doc.text(cfg.companyName,        INFO_X, y,      { width: INFO_W, align: "right" });
  doc.text(cfg.address1,           INFO_X, y + 10, { width: INFO_W, align: "right" });
  doc.text(cfg.address2,           INFO_X, y + 19, { width: INFO_W, align: "right" });
  doc.text(cfg.phone,              INFO_X, y + 28, { width: INFO_W, align: "right" });
  doc.text(cfg.email,              INFO_X, y + 37, { width: INFO_W, align: "right" });
  doc.text(`Tax ID: ${cfg.taxId}`, INFO_X, y + 46, { width: INFO_W, align: "right" });

  y += 64;

  // Hairline rule
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── INVOICE TITLE ─────────────────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL).text("INVOICE", M, y, { lineBreak: false });

  // Invoice # badge (top-right of title row)
  const BADGE_W = 148;
  const BADGE_X = M + W - BADGE_W;
  const BADGE_H = 32;
  doc.rect(BADGE_X, y - 2, BADGE_W, BADGE_H).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN).text("INVOICE #", BADGE_X + 8, y + 3);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("white").text(invoiceNumber, BADGE_X + 8, y + 13, { width: BADGE_W - 16 });

  y += 38;

  // ── ADDRESS + META GRID ───────────────────────────────────
  const C1 = M;
  const C2 = M + 160;
  const C3 = M + 335;
  const C4 = M + 440;

  // Labels row
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("BILL TO",    C1, y);
  doc.text("SHIP TO",    C2, y);
  doc.text("SHIP DATE",  C3, y);
  doc.text("INVOICE DATE", C4, y);
  y += 10;

  const billLines = [client?.name || "", ...(client?.billAddress || "").split("\n").filter(Boolean), client?.rfc || ""].filter(Boolean);
  const shipLines = [client?.name || "", ...(client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean)].filter(Boolean);

  // Place address columns
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  let yB = y, yS = y;
  billLines.forEach(l => { doc.text(l, C1, yB, { width: 152, lineBreak: false }); yB += 10; });
  shipLines.forEach(l => { doc.text(l, C2, yS, { width: 165, lineBreak: false }); yS += 10; });

  // Right meta block
  doc.text(formatDate(inv.shipmentDate),  C3, y);
  doc.text(formatDate(invoiceDate),       C4, y);
  y += 12;
  doc.fontSize(6).fillColor(GRAY);
  doc.text("SHIP VIA",     C3, y);
  doc.text("TERMS",        C4, y);
  y += 8;
  doc.fontSize(7.5).fillColor(DARK);
  doc.text(po.terms || "—",          C3, y, { width: 100 });
  doc.text(`Net ${termsDays}`,        C4, y);
  y += 12;
  doc.fontSize(6).fillColor(GRAY).text("DUE DATE",  C4, y); y += 8;
  doc.fontSize(7.5).fillColor(DARK).text(formatDate(dueDate), C4, y);

  y = Math.max(yB, yS) + 16;

  // ── PO / BOL ROW ─────────────────────────────────────────
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("PURCHASE ORDER", C1, y);
  if (inv.blNumber) doc.text("BOL #", C2, y);
  if (inv.vehicleId) doc.text("VEHICLE / TRACKING", C3, y);
  if (inv.destination) doc.text("DESTINATION", C4, y);
  y += 9;
  doc.fontSize(8).font("Helvetica").fillColor(DARK);
  doc.text(inv.salesDocument || po.clientPoNumber || po.poNumber, C1, y);
  if (inv.blNumber) doc.text(inv.blNumber, C2, y);
  if (inv.vehicleId) doc.text(inv.vehicleId, C3, y);
  if (inv.destination) doc.text(inv.destination, C4, y);
  y += 20;

  // ── LINE ITEMS TABLE ──────────────────────────────────────
  const TC = { date: M + 4, product: M + 70, bales: M + 306, admt: M + 372, price: M + 424, total: M + 482 };

  // Table header
  doc.rect(M, y, W, 17).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor("white");
  doc.text("DATE",       TC.date,    y + 5);
  doc.text("PRODUCT",    TC.product, y + 5);
  doc.text("BALES/UNIT", TC.bales,   y + 5);
  doc.text("ADMT",       TC.admt,    y + 5);
  doc.text("PRICE/TON",  TC.price,   y + 5);
  doc.text("TOTAL",      TC.total,   y + 5);
  y += 17;

  // Item row
  const ROW_H = 44;
  doc.rect(M, y, W, ROW_H).fill(LGRAY);
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(inv.shipmentDate || invoiceDate), TC.date,    y + 8);
  doc.text(productLine,                                  TC.product, y + 8, { width: 228, lineGap: 1.5 });
  doc.text(balesDisplay,                                 TC.bales,   y + 8);
  doc.text(inv.quantityTons.toFixed(3),                  TC.admt,    y + 8);
  doc.text(price.toFixed(2),                             TC.price,   y + 8);
  doc.text(fmtCurrency(total),                           TC.total,   y + 8);
  y += ROW_H;

  // Rule below table
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 14;

  // ── BALANCE DUE ───────────────────────────────────────────
  const BAL_W = 210;
  const BAL_X = M + W - BAL_W;
  doc.rect(BAL_X, y, BAL_W, 30).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN).text("BALANCE DUE", BAL_X + 10, y + 6);
  doc.fontSize(12).font("Helvetica-Bold").fillColor("white").text(`USD ${fmtCurrency(total)}`, BAL_X + 10, y + 15, { width: BAL_W - 20, align: "right" });
  y += 42;

  // ── PAYMENT INSTRUCTIONS ──────────────────────────────────
  if (cfg.showPaymentInstructions !== false) {
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(GRAY).text("PAYMENT INSTRUCTIONS", M, y);
    y += 10;
    doc.fontSize(7).font("Helvetica").fillColor(DARK);
    const payLines = [
      `Bank: ${cfg.bankName}`,
      `Address: ${cfg.bankAddress}`,
      `Beneficiary: ${cfg.bankBeneficiary}`,
      `Account #: ${cfg.bankAccount}  ·  Routing: ${cfg.bankRouting}`,
      `SWIFT: ${cfg.bankSwift}`,
    ];
    payLines.forEach(l => { doc.text(l, M, y); y += 9; });
    y += 8;
  }

  // ── FSC CERTIFICATE ───────────────────────────────────────
  if (cfg.showFscSection !== false) {
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(GRAY).text("FSC CERTIFICATE", M, y);
    y += 10;
    doc.fontSize(7).font("Helvetica").fillColor(DARK);
    doc.text(`Code: ${cfg.fscCode}   ·   Controlled Wood: ${cfg.fscCw}   ·   Expiration: ${cfg.fscExpiration}`, M, y, { width: W * 0.7 });
    y += 10;
  }

  // ── NOTES ─────────────────────────────────────────────────
  if (cfg.invoiceNotes) {
    y += 6;
    doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(cfg.invoiceNotes, M, y, { width: W });
  }

  // ── FOOTER ────────────────────────────────────────────────
  const FOOTER_Y = 746;
  doc.rect(0, FOOTER_Y, 612, 46).fill(TEAL);
  doc.fontSize(7).font("Helvetica").fillColor(CYAN)
    .text(cfg.footerNote, M, FOOTER_Y + 8, { width: W, align: "center" });
  doc.fontSize(6.5).fillColor("white").opacity(0.6)
    .text(`${cfg.companyName}  ·  ${cfg.email}  ·  ${cfg.website}`, M, FOOTER_Y + 20, { width: W, align: "center" });
  doc.opacity(1);
  doc.fontSize(6).fillColor("white").opacity(0.4)
    .text("Page 1 of 1", M, FOOTER_Y + 32, { width: W, align: "center" });
  doc.opacity(1);

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice_${invoiceNumber}_BZA.pdf"`,
    },
  });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
