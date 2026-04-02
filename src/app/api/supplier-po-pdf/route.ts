import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, clients, suppliers, clientPurchaseOrders, supplierOrders, appSettings, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const BZA_DEFAULTS = {
  companyName: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  email: "ebazua@bza-is.com",
  website: "www.bza-is.com",
  primaryColor: "#0d3d3b",
  accentColor: "#4fd1c5",
};


async function getSettings() {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "invoice") });
  if (!row) return BZA_DEFAULTS;
  try { return { ...BZA_DEFAULTS, ...JSON.parse(row.value) }; } catch { return BZA_DEFAULTS; }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const poId = sp.get("poId");
  const soId = sp.get("soId");
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const [po, cfg] = await Promise.all([
    db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, Number(poId)) }),
    getSettings(),
  ]);
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const [client, supplier] = await Promise.all([
    db.query.clients.findFirst({ where: eq(clients.id, po.clientId) }),
    db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) }),
  ]);

  // Resolve supplier product name for PDF
  let supplierProductName: string | null = null;
  if (po.supplierProductId) {
    const prod = await db.query.products.findFirst({ where: eq(products.id, po.supplierProductId) });
    supplierProductName = prod?.name ?? null;
  }
  const effectiveProductName = supplierProductName || po.product;

  const supplierAddress = (supplier?.address || "").split("\n").filter(Boolean);
  const clientAddress = (client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean);

  let lineItems: { description: string; qty: number; rate: number; amount: number }[];
  let poDate: string;
  let effectiveIncoterm: string;

  if (soId) {
    const so = await db.query.supplierOrders.findFirst({ where: eq(supplierOrders.id, Number(soId)) });
    if (!so) return NextResponse.json({ error: "Supplier order not found" }, { status: 404 });
    const price = so.pricePerTon ?? po.buyPrice;
    poDate = so.orderDate || po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = so.incoterm ?? po.terms ?? "";
    const parsedLines = so.lines ? JSON.parse(so.lines) as { destination: string; tons: number; notes: string }[] : null;
    if (parsedLines && parsedLines.length > 0) {
      lineItems = parsedLines.map(l => ({
        description: `${effectiveProductName}${l.destination ? ` – ${l.destination}` : ""}${l.notes ? `\n${l.notes}` : ""}`,
        qty: l.tons, rate: price, amount: l.tons * price,
      }));
    } else {
      lineItems = [{ description: effectiveProductName, qty: so.tons, rate: price, amount: so.tons * price }];
    }
  } else {
    const cpos = await db.select().from(clientPurchaseOrders)
      .where(eq(clientPurchaseOrders.purchaseOrderId, Number(poId)))
      .orderBy(clientPurchaseOrders.clientPoNumber);
    lineItems = cpos.map(cpo => ({
      description: `${effectiveProductName}${cpo.destination ? ` – ${cpo.destination}` : ""}`,
      qty: cpo.plannedTons ?? 0, rate: po.buyPrice, amount: (cpo.plannedTons ?? 0) * po.buyPrice,
    }));
    if (lineItems.length === 0) {
      lineItems = [{ description: effectiveProductName, qty: 0, rate: po.buyPrice, amount: 0 }];
    }
    poDate = po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = po.terms ?? "";
  }

  const total = lineItems.reduce((s, l) => s + l.amount, 0);

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M    = 48;
  const W    = 612 - M * 2;  // 516
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
  doc.text(cfg.companyName, IX, y,      { width: IW, align: "right" });
  doc.text(cfg.address1,    IX, y + 10, { width: IW, align: "right" });
  doc.text(cfg.address2,    IX, y + 19, { width: IW, align: "right" });
  doc.text(cfg.email,       IX, y + 28, { width: IW, align: "right" });
  doc.text(cfg.website,     IX, y + 37, { width: IW, align: "right" });
  y += 56;

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── TITLE + PO # BADGE ────────────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL)
    .text("PURCHASE ORDER", M, y, { lineBreak: false });

  const BW = 150; const BX = M + W - BW;
  doc.rect(BX, y - 2, BW, 32).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN)
    .text("PO NUMBER", BX + 8, y + 3, { lineBreak: false });
  doc.fontSize(9).font("Helvetica-Bold").fillColor("white")
    .text(po.poNumber, BX + 8, y + 13, { width: BW - 16, lineBreak: false });
  y += 40;

  // ── 2-COLUMN META STRIP (DATE | INCOTERM, full width) ────
  const COL2 = Math.floor(W / 2);  // 258px each
  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("DATE",     M,        y, { width: COL2 - 6, lineBreak: false });
  doc.text("INCOTERM", M + COL2, y, { width: COL2 - 6, lineBreak: false });
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(poDate),            M,        y + 9, { width: COL2 - 6, lineBreak: false });
  doc.text(effectiveIncoterm || "—",      M + COL2, y + 9, { width: COL2 - 6, lineBreak: false });
  y += 26;

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 10;

  // ── VENDOR / SHIP TO ─────────────────────────────────────
  const ADDR_W = Math.floor((W - 24) / 2);  // 246px each
  const CA = M;
  const CB = M + ADDR_W + 24;

  const vendorLines = [supplier?.name || "", ...supplierAddress].filter(Boolean);
  const shipToLines = [client?.name || "", ...clientAddress].filter(Boolean);

  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("VENDOR",  CA, y, { lineBreak: false });
  doc.text("SHIP TO", CB, y, { lineBreak: false });
  y += 10;

  const vendorText  = vendorLines.join("\n");
  const shipToText  = shipToLines.join("\n");
  const vendorH = doc.heightOfString(vendorText,  { width: ADDR_W });
  const shipToH = doc.heightOfString(shipToText,  { width: ADDR_W });
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(vendorText,  CA, y, { width: ADDR_W });
  doc.text(shipToText,  CB, y, { width: ADDR_W });
  y += Math.max(vendorH, shipToH) + 14;

  // ── TABLE HEADER ─────────────────────────────────────────
  const TC = { desc: M + 6, qty: M + 355, rate: M + 415, amount: M + 472 };

  doc.rect(M, y, W, 17).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor("white");
  doc.text("DESCRIPTION",   TC.desc,   y + 5, { lineBreak: false });
  doc.text("QTY (TN)",      TC.qty,    y + 5, { lineBreak: false });
  doc.text("RATE (USD/TN)", TC.rate,   y + 5, { lineBreak: false });
  doc.text("AMOUNT",        TC.amount, y + 5, { lineBreak: false });
  y += 17;

  // ── LINE ITEMS ────────────────────────────────────────────
  lineItems.forEach((item, i) => {
    const descH = doc.heightOfString(item.description, { width: 340 });
    const rowH = Math.max(26, descH + 14);
    if (i % 2 === 0) doc.rect(M, y, W, rowH).fill(LGRY);
    doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
    doc.text(item.description,        TC.desc,   y + 7, { width: 340, lineGap: 1.5 });
    doc.text(item.qty.toFixed(0),     TC.qty,    y + 7, { lineBreak: false });
    doc.text(`$${item.rate.toFixed(2)}`,    TC.rate,   y + 7, { lineBreak: false });
    doc.text(`$${fmtCurrency(item.amount)}`, TC.amount, y + 7, { lineBreak: false });
    y += rowH;
  });

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── TOTAL ─────────────────────────────────────────────────
  const TW = 210; const TX = M + W - TW;
  doc.rect(TX, y, TW, 30).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN)
    .text("TOTAL (USD)", TX + 10, y + 6, { lineBreak: false });
  doc.fontSize(12).font("Helvetica-Bold").fillColor("white")
    .text(`$${fmtCurrency(total)} USD`, TX + 10, y + 16, { width: TW - 28, align: "right", lineBreak: false });
  y += 44;

  // ── CERTIFICATION NOTE ────────────────────────────────────
  const certNote = getCertNote(po);
  if (certNote) {
    doc.rect(M, y, W * 0.7, 20).fill("#f0fdf4");
    doc.fontSize(7).font("Helvetica").fillColor("#166534")
      .text(certNote, M + 8, y + 6, { width: W * 0.7 - 16, lineBreak: false });
    y += 28;
  }

  // ── SIGNATURE LINES ───────────────────────────────────────
  y += 6;
  doc.fontSize(7).font("Helvetica").fillColor(GRAY)
    .text("Authorized By", M, y, { lineBreak: false });
  doc.moveTo(M + 76, y + 9).lineTo(M + 270, y + 9).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 20;
  doc.text("Date", M, y, { lineBreak: false });
  doc.moveTo(M + 76, y + 9).lineTo(M + 270, y + 9).strokeColor(RULE).lineWidth(0.5).stroke();

  // ── FOOTER ────────────────────────────────────────────────
  doc.rect(0, 746, 612, 46).fill(TEAL);
  doc.fontSize(7).font("Helvetica").fillColor(CYAN)
    .text(cfg.companyName, M, 754, { width: W, align: "center" });
  doc.fillColor("white")
    .text(`${cfg.email}  ·  ${cfg.website}`, M, 764, { width: W, align: "center" });
  doc.fontSize(6).text("Page 1 of 1", M, 775, { width: W, align: "center" });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SupplierPO_${po.poNumber}_BZA.pdf"`,
    },
  });
}

function getCertNote(po: { certType?: string | null; licenseFsc?: string | null; inputClaim?: string | null; pefc?: string | null }): string | null {
  if (po.certType === "pefc" || (!po.certType && po.pefc)) {
    return `PEFC-certified material required. Supplier must include valid PEFC certificate on all invoices and shipping documents.`;
  }
  if (po.certType === "fsc" || (!po.certType && (po.licenseFsc || po.inputClaim))) {
    return "FSC-certified material required. Supplier must include valid FSC certificate on all invoices and shipping documents.";
  }
  return null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
