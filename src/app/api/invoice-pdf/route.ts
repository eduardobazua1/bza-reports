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

  const M    = 48;
  const W    = 612 - M * 2;   // 516
  const TEAL = cfg.primaryColor;
  const CYAN = cfg.accentColor;
  const DARK = "#1c1917";
  const GRAY = "#6b7280";
  const LGRY = "#f3f4f6";
  const RULE = "#d1d5db";

  let y = M;

  // ── CYAN TOP BAR ─────────────────────────────────────────
  doc.rect(0, 0, 612, 3).fill(CYAN);

  // ── LOGO ─────────────────────────────────────────────────
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEAL)
    .text("BZA", M, y, { continued: true, lineBreak: false });
  doc.fillColor(CYAN).text(".", { lineBreak: false });

  // ── COMPANY INFO right side ───────────────────────────────
  const IX = 360;
  const IW = 612 - M - IX;
  doc.fontSize(7).font("Helvetica").fillColor(GRAY);
  doc.text(cfg.companyName,        IX, y,      { width: IW, align: "right" });
  doc.text(cfg.address1,           IX, y + 10, { width: IW, align: "right" });
  doc.text(cfg.address2,           IX, y + 19, { width: IW, align: "right" });
  doc.text(cfg.phone,              IX, y + 28, { width: IW, align: "right" });
  doc.text(cfg.email,              IX, y + 37, { width: IW, align: "right" });
  doc.text(`Tax ID: ${cfg.taxId}`, IX, y + 46, { width: IW, align: "right" });
  y += 62;

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── TITLE + INVOICE # BADGE ───────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL)
    .text("INVOICE", M, y, { lineBreak: false });

  const BW = 150; const BX = M + W - BW;
  doc.rect(BX, y - 2, BW, 32).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN)
    .text("INVOICE #", BX + 8, y + 3, { lineBreak: false });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("white")
    .text(invoiceNumber, BX + 8, y + 13, { width: BW - 16, lineBreak: false });
  y += 38;

  // ── INVOICE META (right block, below badge) ───────────────
  // This goes at top-right, below the badge, aligned right
  const META_X = BX;
  const META_W = BW;
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("DATE",     META_X, y,      { width: META_W, align: "left" });
  doc.text("DUE DATE", META_X + 76, y, { lineBreak: false });
  y += 9;
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(invoiceDate), META_X, y, { width: 70, lineBreak: false });
  doc.text(formatDate(dueDate),     META_X + 76, y, { width: 74, lineBreak: false });
  y += 9;
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("TERMS",    META_X, y, { lineBreak: false });
  doc.text("SHIP VIA", META_X + 76, y, { lineBreak: false });
  y += 9;
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(`Net ${termsDays}`,    META_X,      y, { width: 70, lineBreak: false });
  doc.text(po.terms || "—",       META_X + 76, y, { width: 74, lineBreak: false });
  y += 18;

  // ── BILL TO / SHIP TO ─────────────────────────────────────
  // Two wide columns: each 240px wide, separated by 24px gap
  const ADDR_W = 240;
  const CA = M;          // Bill To starts at left margin
  const CB = M + ADDR_W + 24;  // Ship To starts 264px in

  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("BILL TO", CA, y, { lineBreak: false });
  doc.text("SHIP TO", CB, y, { lineBreak: false });
  y += 10;

  const billLines = [
    client?.name || "",
    ...(client?.billAddress || "").split("\n").filter(Boolean),
    client?.rfc || "",
  ].filter(Boolean);

  const shipLines = [
    client?.name || "",
    ...(client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean),
  ].filter(Boolean);

  // Draw each address line at explicit position — no `continued` to avoid cursor drift
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  const maxAddrLines = Math.max(billLines.length, shipLines.length);
  for (let i = 0; i < maxAddrLines; i++) {
    if (billLines[i]) doc.text(billLines[i], CA, y + i * 10, { width: ADDR_W, lineBreak: false });
    if (shipLines[i]) doc.text(shipLines[i], CB, y + i * 10, { width: ADDR_W, lineBreak: false });
  }
  y += maxAddrLines * 10 + 16;

  // ── PO / BOL / DESTINATION ROW ───────────────────────────
  const fields: Array<[string, string]> = [
    ["PURCHASE ORDER", inv.salesDocument || po.clientPoNumber || po.poNumber],
  ];
  if (inv.blNumber) fields.push(["BOL #", inv.blNumber]);
  if (inv.vehicleId) fields.push(["TRACKING", inv.vehicleId]);
  if (inv.destination) fields.push(["DESTINATION", inv.destination]);
  if (inv.shipmentDate) fields.push(["SHIP DATE", formatDate(inv.shipmentDate)]);

  const fieldW = Math.floor(W / fields.length);
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  fields.forEach(([label], i) => doc.text(label, M + i * fieldW, y, { width: fieldW, lineBreak: false }));
  y += 9;
  doc.fontSize(8).font("Helvetica").fillColor(DARK);
  fields.forEach(([, val], i) => doc.text(val, M + i * fieldW, y, { width: fieldW, lineBreak: false }));
  y += 18;

  // ── TABLE HEADER ─────────────────────────────────────────
  const TC = { date: M + 4, product: M + 70, bales: M + 308, admt: M + 374, price: M + 426, total: M + 484 };

  doc.rect(M, y, W, 17).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor("white");
  doc.text("DATE",       TC.date,    y + 5, { lineBreak: false });
  doc.text("PRODUCT",    TC.product, y + 5, { lineBreak: false });
  doc.text("BALES/UNIT", TC.bales,   y + 5, { lineBreak: false });
  doc.text("ADMT",       TC.admt,    y + 5, { lineBreak: false });
  doc.text("PRICE/TON",  TC.price,   y + 5, { lineBreak: false });
  doc.text("TOTAL",      TC.total,   y + 5, { lineBreak: false });
  y += 17;

  // ── LINE ITEM ─────────────────────────────────────────────
  const productH = doc.heightOfString(productLine, { width: 228 });
  const ROW_H = Math.max(36, productH + 18);
  doc.rect(M, y, W, ROW_H).fill(LGRY);
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(inv.shipmentDate || invoiceDate), TC.date,    y + 8, { lineBreak: false });
  doc.text(productLine,                                  TC.product, y + 8, { width: 230, lineGap: 1.5 });
  doc.text(balesDisplay,                                 TC.bales,   y + 8, { lineBreak: false });
  doc.text(inv.quantityTons.toFixed(3),                  TC.admt,    y + 8, { lineBreak: false });
  doc.text(price.toFixed(2),                             TC.price,   y + 8, { lineBreak: false });
  doc.text(fmtCurrency(total),                           TC.total,   y + 8, { lineBreak: false });
  y += ROW_H;

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── BALANCE DUE ───────────────────────────────────────────
  const BDW = 200; const BDX = M + W - BDW;
  doc.rect(BDX, y, BDW, 30).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN)
    .text("BALANCE DUE", BDX + 10, y + 6, { lineBreak: false });
  doc.fontSize(12).font("Helvetica-Bold").fillColor("white")
    .text(`USD ${fmtCurrency(total)}`, BDX + 10, y + 16, { width: BDW - 20, align: "right", lineBreak: false });
  y += 42;

  // ── PAYMENT INSTRUCTIONS ──────────────────────────────────
  if (cfg.showPaymentInstructions !== false) {
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(GRAY).text("PAYMENT INSTRUCTIONS", M, y);
    y += 10;
    doc.fontSize(7).font("Helvetica").fillColor(DARK);
    const payLines = [
      `Bank: ${cfg.bankName}  ·  ${cfg.bankAddress}`,
      `Beneficiary: ${cfg.bankBeneficiary}`,
      `Account: ${cfg.bankAccount}   Routing: ${cfg.bankRouting}   SWIFT: ${cfg.bankSwift}`,
    ];
    payLines.forEach(l => { doc.text(l, M, y, { width: W }); y += 10; });
    y += 6;
  }

  // ── FSC CERTIFICATE ───────────────────────────────────────
  if (cfg.showFscSection !== false) {
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(GRAY).text("FSC CERTIFICATE", M, y);
    y += 9;
    doc.fontSize(7).font("Helvetica").fillColor(DARK)
      .text(`Code: ${cfg.fscCode}   ·   Controlled Wood: ${cfg.fscCw}   ·   Expiration: ${cfg.fscExpiration}`, M, y, { width: W });
    y += 10;
  }

  if (cfg.invoiceNotes) {
    y += 4;
    doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(cfg.invoiceNotes, M, y, { width: W });
  }

  // ── FOOTER ────────────────────────────────────────────────
  doc.rect(0, 746, 612, 46).fill(TEAL);
  doc.fontSize(7).font("Helvetica").fillColor(CYAN)
    .text(cfg.footerNote, M, 754, { width: W, align: "center" });
  doc.fillColor("white")
    .text(`${cfg.companyName}  ·  ${cfg.email}  ·  ${cfg.website}`, M, 764, { width: W, align: "center" });
  doc.fontSize(6).text("Page 1 of 1", M, 775, { width: W, align: "center" });

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
