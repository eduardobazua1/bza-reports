import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers, appSettings, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

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

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  void supplier;

  const clientProd = po.clientProductId
    ? await db.query.products.findFirst({ where: eq(products.id, po.clientProductId) })
    : null;

  const price = inv.sellPriceOverride ?? po.sellPrice;
  const total = inv.quantityTons * price;
  const invoiceDate = inv.invoiceDate || inv.shipmentDate || new Date().toISOString().split("T")[0];
  const termsDays = (inv.paymentTermsDays != null && inv.paymentTermsDays > 0)
    ? inv.paymentTermsDays
    : (client?.paymentTermsDays != null && client.paymentTermsDays > 0)
      ? client.paymentTermsDays : 60;
  const dueDateObj = new Date(invoiceDate + "T12:00:00");
  dueDateObj.setDate(dueDateObj.getDate() + termsDays);
  const dueDate = dueDateObj.toISOString().split("T")[0];
  const productLine = clientProd?.name || inv.item || po.product || "Woodpulp";
  const balesDisplay = inv.balesCount && inv.unitsPerBale
    ? `${inv.balesCount}/${inv.unitsPerBale}`
    : inv.balesCount ? String(inv.balesCount) : "";

  // ── pdf-lib setup ─────────────────────────────────────────
  const PAGE_W = 612, PAGE_H = 792, M = 48, W = PAGE_W - M * 2;
  const TEAL  = hexToRgb(cfg.primaryColor);
  const CYAN  = hexToRgb(cfg.accentColor);
  const DARK  = rgb(0.11, 0.098, 0.09);
  const GRAY  = rgb(0.42, 0.447, 0.502);
  const LGRY  = rgb(0.953, 0.957, 0.965);
  const RULE  = rgb(0.82, 0.835, 0.859);
  const WHITE = rgb(1, 1, 1);

  const BY = (y: number) => PAGE_H - y;
  const RY = (y: number, h: number) => PAGE_H - y - h;

  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const CAP = 0.716;

  function dt(text: string, x: number, pkY: number, size: number, f: typeof font, color: typeof DARK) {
    page.drawText(text, { x, y: BY(pkY) - size * CAP, size, font: f, color });
  }
  function dtR(text: string, rx: number, pkY: number, size: number, f: typeof font, color: typeof DARK) {
    dt(text, rx - f.widthOfTextAtSize(text, size), pkY, size, f, color);
  }
  function dr(x: number, pkY: number, w: number, h: number, color: typeof TEAL) {
    page.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
  }
  function dl(x1: number, y1: number, x2: number, y2: number) {
    page.drawLine({ start: { x: x1, y: BY(y1) }, end: { x: x2, y: BY(y2) }, thickness: 0.5, color: RULE });
  }
  function wrapText(text: string, maxW: number, f: typeof font, size: number): string[] {
    const words = text.split(" "); const lines: string[] = []; let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) <= maxW) { cur = test; }
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  let y = M;

  // Cyan top bar
  dr(0, 0, PAGE_W, 3, CYAN);

  // Logo
  dt("BZA", M, y, 20, fontB, TEAL);
  dt(".", M + fontB.widthOfTextAtSize("BZA", 20), y, 20, fontB, CYAN);

  // Company info (right)
  const IX = 360, IW = PAGE_W - M - IX;
  const infoLines = [cfg.companyName, cfg.address1, cfg.address2, cfg.phone, cfg.email, `Tax ID: ${cfg.taxId}`];
  infoLines.forEach((line, i) => {
    const tw = font.widthOfTextAtSize(line, 7);
    dt(line, Math.max(IX, IX + IW - tw), y + i * 9, 7, font, GRAY);
  });
  y += 66;

  dl(M, y, M + W, y); y += 12;

  // Title + Invoice # badge
  dt("INVOICE", M, y, 22, fontB, TEAL);
  const BW = 150, BX = M + W - BW;
  dr(BX, y - 2, BW, 32, TEAL);
  dt("INVOICE #", BX + 8, y + 3, 6.5, fontB, CYAN);
  dt(invoiceNumber, BX + 8, y + 13, 9, fontB, WHITE);
  y += 40;

  // 4-column meta strip
  const COL = Math.floor(W / 4);
  const metaCols = [
    { label: "DATE",     value: formatDate(invoiceDate), x: M },
    { label: "DUE DATE", value: formatDate(dueDate),     x: M + COL },
    { label: "TERMS",    value: `Net ${termsDays}`,      x: M + COL * 2 },
    { label: "SHIP VIA", value: po.terms || "—",         x: M + COL * 3 },
  ];
  metaCols.forEach(({ label, x }) => dt(label, x, y, 6, fontB, GRAY));
  metaCols.forEach(({ value, x }) => dt(value, x, y + 9, 7.5, font, DARK));
  y += 26;

  dl(M, y, M + W, y); y += 10;

  // Bill To / Ship To
  const ADDR_W = Math.floor((W - 24) / 2);
  const CA = M, CB = M + ADDR_W + 24;

  const billLines = [client?.name || "", ...(client?.billAddress || "").split("\n"), client?.rfc || ""].filter(Boolean);
  const shipLines = [client?.name || "", ...(client?.shipAddress || client?.billAddress || "").split("\n")].filter(Boolean);

  dt("BILL TO", CA, y, 6, fontB, GRAY);
  dt("SHIP TO", CB, y, 6, fontB, GRAY);
  y += 10;

  const addrSize = 7.5, addrLineH = addrSize * 1.5;
  let billH = 0, shipH = 0;
  billLines.forEach(line => {
    wrapText(line, ADDR_W, font, addrSize).forEach((l, i) => dt(l, CA, y + billH + i * addrLineH, addrSize, font, DARK));
    billH += wrapText(line, ADDR_W, font, addrSize).length * addrLineH;
  });
  shipLines.forEach(line => {
    wrapText(line, ADDR_W, font, addrSize).forEach((l, i) => dt(l, CB, y + shipH + i * addrLineH, addrSize, font, DARK));
    shipH += wrapText(line, ADDR_W, font, addrSize).length * addrLineH;
  });
  y += Math.max(billH, shipH) + 14;

  // Reference row
  const refCols: { label: string; value: string; x: number; w: number }[] = [
    { label: "PURCHASE ORDER", value: inv.salesDocument || po.clientPoNumber || po.poNumber, x: M,       w: 130 },
    { label: inv.blNumber ? "BOL #" : "TRACKING", value: inv.blNumber || inv.vehicleId || "—", x: M+140, w: 100 },
    { label: "DESTINATION",    value: inv.destination || "—",      x: M + 250, w: 150 },
    { label: "SHIP DATE",      value: formatDate(inv.shipmentDate), x: M + 410, w: 106 },
  ];
  refCols.forEach(({ label, x }) => dt(label, x, y, 6, fontB, GRAY));
  refCols.forEach(({ value, x, w }) => {
    const lines = wrapText(value, w, font, 8);
    lines.forEach((l, i) => dt(l, x, y + 9 + i * 10, 8, font, DARK));
  });
  y += 26;

  // Table header
  const TC = { date: M+4, product: M+70, bales: M+308, admt: M+374, price: M+426, total: M+W-6 };
  dr(M, y, W, 17, TEAL);
  dt("DATE",       TC.date,    y + 5, 6.5, fontB, WHITE);
  dt("PRODUCT",    TC.product, y + 5, 6.5, fontB, WHITE);
  dt("BALES/UNIT", TC.bales,   y + 5, 6.5, fontB, WHITE);
  dt("ADMT",       TC.admt,    y + 5, 6.5, fontB, WHITE);
  dt("PRICE/TON",  TC.price,   y + 5, 6.5, fontB, WHITE);
  dtR("TOTAL",     TC.total,   y + 5, 6.5, fontB, WHITE);
  y += 17;

  // Line item
  const ROW_H = 36;
  dr(M, y, W, ROW_H, LGRY);
  dt(formatDate(inv.shipmentDate || invoiceDate), TC.date,    y + 9, 7.5, font, DARK);
  const prodLines = wrapText(productLine, 228, font, 7.5);
  prodLines.forEach((l, i) => dt(l, TC.product, y + 9 + i * 10, 7.5, font, DARK));
  if (balesDisplay) dt(balesDisplay, TC.bales, y + 9, 7.5, font, DARK);
  dt(inv.quantityTons.toFixed(3), TC.admt,  y + 9, 7.5, font, DARK);
  dt(`$${price.toFixed(2)}`,    TC.price,   y + 9, 7.5, font, DARK);
  dtR(`$${fmtCurrency(total)}`, TC.total,   y + 9, 7.5, font, DARK);
  y += ROW_H;

  dl(M, y, M + W, y); y += 12;

  // Balance Due
  const BDW = 240, BDX = M + W - BDW;
  dr(BDX, y, BDW, 32, TEAL);
  dt("BALANCE DUE", BDX + 10, y + 6, 6.5, fontB, CYAN);
  dtR(`$${fmtCurrency(total)} USD`, BDX + BDW - 10, y + 17, 11, fontB, WHITE);
  y += 44;

  // Payment Instructions
  if (cfg.showPaymentInstructions !== false) {
    dt("PAYMENT INSTRUCTIONS", M, y, 6.5, fontB, GRAY); y += 10;
    const payLines = [
      `Bank: ${cfg.bankName}  ·  ${cfg.bankAddress}`,
      `Beneficiary: ${cfg.bankBeneficiary}`,
      `Account: ${cfg.bankAccount}   Routing: ${cfg.bankRouting}   SWIFT: ${cfg.bankSwift}`,
    ];
    payLines.forEach(l => { dt(l, M, y, 7, font, DARK); y += 10; });
    y += 6;
  }

  // FSC / PEFC section
  if (cfg.showFscSection !== false) {
    const isPefc = po.certType === "pefc";
    dt(isPefc ? "PEFC CERTIFICATE" : "FSC CERTIFICATE", M, y, 6.5, fontB, GRAY); y += 9;
    if (isPefc) {
      dt(`PEFC Number: ${po.pefc || "—"}`, M, y, 7, font, DARK);
    } else {
      dt(`Code: ${cfg.fscCode}   ·   Controlled Wood: ${cfg.fscCw}   ·   Expiration: ${cfg.fscExpiration}`, M, y, 7, font, DARK);
    }
    y += 10;
  }

  if (cfg.invoiceNotes) {
    y += 4;
    dt(cfg.invoiceNotes, M, y, 7, font, GRAY);
  }

  // Footer
  dr(0, 746, PAGE_W, 46, TEAL);
  const footerW = font.widthOfTextAtSize(cfg.footerNote, 7);
  dt(cfg.footerNote, (PAGE_W - footerW) / 2, 754, 7, font, CYAN);
  const contactStr = `${cfg.companyName}  ·  ${cfg.email}  ·  ${cfg.website}`;
  const contactW = font.widthOfTextAtSize(contactStr, 7);
  dt(contactStr, (PAGE_W - contactW) / 2, 764, 7, font, WHITE);
  dt("Page 1 of 1", M, 775, 6, font, WHITE);

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice_${invoiceNumber}_BZA.pdf"`,
    },
  });
}
