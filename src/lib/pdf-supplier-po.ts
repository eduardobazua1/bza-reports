import { db } from "@/db";
import {
  purchaseOrders, clients, suppliers,
  clientPurchaseOrders, supplierOrders, appSettings, products,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function getCertNote(po: { certType?: string | null; licenseFsc?: string | null; inputClaim?: string | null; pefc?: string | null }): string | null {
  if (po.certType === "pefc" || (!po.certType && po.pefc)) {
    return "PEFC-certified material required. Supplier must include valid PEFC certificate on all invoices and shipping documents.";
  }
  if (po.certType === "fsc" || (!po.certType && (po.licenseFsc || po.inputClaim))) {
    return "FSC-certified material required. Supplier must include valid FSC certificate on all invoices and shipping documents.";
  }
  return null;
}

export async function generateSupplierPoPdf(poId: number, soId?: number | null): Promise<Buffer> {
  const [po, cfg] = await Promise.all([
    db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) }),
    getSettings(),
  ]);
  if (!po) throw new Error("PO not found");

  const [client, supplier] = await Promise.all([
    db.query.clients.findFirst({ where: eq(clients.id, po.clientId) }),
    db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) }),
  ]);

  let supplierProductName: string | null = null;
  if (po.supplierProductId) {
    const prod = await db.query.products.findFirst({ where: eq(products.id, po.supplierProductId) });
    supplierProductName = prod?.name ?? null;
  }
  const effectiveProductName = supplierProductName || po.product || "";

  const supplierAddress = (supplier?.address || "").split("\n").filter(Boolean);
  const clientAddress = (client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean);

  let lineItems: { description: string; qty: number; rate: number; amount: number }[];
  let poDate: string;
  let effectiveIncoterm: string;

  if (soId) {
    const so = await db.query.supplierOrders.findFirst({ where: eq(supplierOrders.id, soId) });
    if (!so) throw new Error("Supplier order not found");
    const price = so.pricePerTon ?? po.buyPrice;
    poDate = so.orderDate || po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = so.incoterm ?? po.terms ?? "";
    const parsedLines = so.lines ? JSON.parse(so.lines) as { destination: string; tons: number; notes: string }[] : null;
    if (parsedLines && parsedLines.length > 0) {
      lineItems = parsedLines.map(l => ({
        description: `${effectiveProductName}${l.destination ? ` - ${l.destination}` : ""}${l.notes ? `  ${l.notes}` : ""}`,
        qty: l.tons, rate: price, amount: l.tons * price,
      }));
    } else {
      lineItems = [{ description: effectiveProductName, qty: so.tons, rate: price, amount: so.tons * price }];
    }
  } else {
    const cpos = await db.select().from(clientPurchaseOrders)
      .where(eq(clientPurchaseOrders.purchaseOrderId, poId))
      .orderBy(clientPurchaseOrders.clientPoNumber);
    lineItems = cpos.map(cpo => ({
      description: `${effectiveProductName}${cpo.destination ? ` - ${cpo.destination}` : ""}`,
      qty: cpo.plannedTons ?? 0, rate: po.buyPrice, amount: (cpo.plannedTons ?? 0) * po.buyPrice,
    }));
    if (lineItems.length === 0) {
      lineItems = [{ description: effectiveProductName, qty: 0, rate: po.buyPrice, amount: 0 }];
    }
    poDate = po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = po.terms ?? "";
  }

  const total = lineItems.reduce((s, l) => s + l.amount, 0);

  // ── pdf-lib setup ─────────────────────────────────────────
  const PAGE_W = 612;
  const PAGE_H = 792;
  const M = 48;
  const W = PAGE_W - M * 2;

  const TEAL = hexToRgb(cfg.primaryColor);
  const CYAN = hexToRgb(cfg.accentColor);
  const DARK = rgb(0.11, 0.098, 0.09);
  const GRAY = rgb(0.42, 0.447, 0.502);
  const LGRY = rgb(0.953, 0.957, 0.965);
  const RULE = rgb(0.82, 0.835, 0.859);
  const WHITE = rgb(1, 1, 1);
  const GREEN_BG = rgb(0.94, 0.99, 0.957);
  const GREEN_TXT = rgb(0.086, 0.396, 0.204);

  // y helpers: pk = pdfkit top-origin → pdf-lib bottom-origin
  const BY = (pkY: number) => PAGE_H - pkY;
  const RY = (pkY: number, h: number) => PAGE_H - pkY - h;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const CAP = 0.716; // cap height ratio

  function drawText(text: string, x: number, pkY: number, size: number, f: typeof font, color: typeof DARK) {
    const capH = size * CAP;
    page.drawText(text, { x, y: BY(pkY) - capH, size, font: f, color });
  }

  function drawTextRight(text: string, rightX: number, pkY: number, size: number, f: typeof font, color: typeof DARK) {
    const tw = f.widthOfTextAtSize(text, size);
    drawText(text, rightX - tw, pkY, size, f, color);
  }

  function drawRect(x: number, pkY: number, w: number, h: number, color: typeof TEAL) {
    page.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
  }

  function drawLine(x1: number, y1: number, x2: number, pkY2: number) {
    page.drawLine({ start: { x: x1, y: BY(y1) }, end: { x: x2, y: BY(pkY2) }, thickness: 0.5, color: RULE });
  }

  let y = M;

  // Top accent bar
  drawRect(0, 0, PAGE_W, 3, CYAN);

  // Logo
  drawText("BZA", M, y, 20, fontB, TEAL);
  const bzaW = fontB.widthOfTextAtSize("BZA", 20);
  drawText(".", M + bzaW, y, 20, fontB, CYAN);

  // Company info (right)
  const IX = 360;
  const IW = PAGE_W - M - IX;
  const infoLines = [cfg.companyName, cfg.address1, cfg.address2, cfg.email, cfg.website];
  infoLines.forEach((line, i) => {
    const tw = font.widthOfTextAtSize(line, 7);
    const x = Math.max(IX, IX + IW - tw);
    drawText(line, x, y + i * 9, 7, font, GRAY);
  });
  y += 56;

  // Divider
  drawLine(M, y, M + W, y);
  y += 12;

  // Title
  drawText("PURCHASE ORDER", M, y, 22, fontB, TEAL);

  // PO number badge
  const BW = 150; const BX = M + W - BW;
  drawRect(BX, y - 2, BW, 32, TEAL);
  drawText("PO NUMBER", BX + 8, y + 3, 6.5, fontB, CYAN);
  drawText(po.poNumber, BX + 8, y + 13, 9, fontB, WHITE);
  y += 40;

  // Date & Incoterm row
  const COL2 = Math.floor(W / 2);
  drawText("DATE",     M,        y, 6, fontB, GRAY);
  drawText("INCOTERM", M + COL2, y, 6, fontB, GRAY);
  drawText(formatDate(poDate),        M,        y + 9, 7.5, font, DARK);
  drawText(effectiveIncoterm || "—",  M + COL2, y + 9, 7.5, font, DARK);
  y += 26;

  drawLine(M, y, M + W, y);
  y += 10;

  // Addresses
  const ADDR_W = Math.floor((W - 24) / 2);
  const CA = M;
  const CB = M + ADDR_W + 24;

  const vendorLines = [supplier?.name || "", ...supplierAddress].filter(Boolean);
  const shipToLines = [client?.name || "", ...clientAddress].filter(Boolean);

  drawText("VENDOR",  CA, y, 6, fontB, GRAY);
  drawText("SHIP TO", CB, y, 6, fontB, GRAY);
  y += 10;

  const addrSize = 7.5;
  const lineH = addrSize * 1.4;
  const vendorH = vendorLines.length * lineH;
  const shipToH = shipToLines.length * lineH;

  vendorLines.forEach((line, i) => drawText(line, CA, y + i * lineH, addrSize, font, DARK));
  shipToLines.forEach((line, i) => drawText(line, CB, y + i * lineH, addrSize, font, DARK));
  y += Math.max(vendorH, shipToH) + 14;

  // Table header
  const TC = { desc: M + 6, qty: M + 355, rate: M + 415, amount: M + 472 };
  drawRect(M, y, W, 17, TEAL);
  drawText("DESCRIPTION",   TC.desc,   y + 5, 6.5, fontB, WHITE);
  drawText("QTY (TN)",      TC.qty,    y + 5, 6.5, fontB, WHITE);
  drawText("RATE (USD/TN)", TC.rate,   y + 5, 6.5, fontB, WHITE);
  drawText("AMOUNT",        TC.amount, y + 5, 6.5, fontB, WHITE);
  y += 17;

  // Table rows
  lineItems.forEach((item, i) => {
    const rowH = 26;
    if (i % 2 === 0) drawRect(M, y, W, rowH, LGRY);
    // Truncate description to fit
    const maxDescW = 340;
    let desc = item.description;
    while (desc.length > 0 && font.widthOfTextAtSize(desc, 7.5) > maxDescW) {
      desc = desc.slice(0, -1);
    }
    drawText(desc,                             TC.desc,   y + 7, 7.5, font, DARK);
    drawText(item.qty.toFixed(0),              TC.qty,    y + 7, 7.5, font, DARK);
    drawText(`$${item.rate.toFixed(2)}`,       TC.rate,   y + 7, 7.5, font, DARK);
    drawText(`$${fmtCurrency(item.amount)}`,   TC.amount, y + 7, 7.5, font, DARK);
    y += rowH;
  });

  drawLine(M, y, M + W, y);
  y += 12;

  // Total box
  const TW = 210; const TX = M + W - TW;
  drawRect(TX, y, TW, 30, TEAL);
  drawText("TOTAL (USD)", TX + 10, y + 6, 6.5, fontB, CYAN);
  const totalStr = `$${fmtCurrency(total)} USD`;
  drawTextRight(totalStr, TX + TW - 10, y + 16, 12, fontB, WHITE);
  y += 44;

  // Cert note
  const certNote = getCertNote(po);
  if (certNote) {
    const noteW = W * 0.7;
    drawRect(M, y, noteW, 20, GREEN_BG);
    drawText(certNote, M + 8, y + 6, 7, font, GREEN_TXT);
    y += 28;
  }

  // Signature lines
  y += 6;
  drawText("Authorized By", M, y, 7, font, GRAY);
  drawLine(M + 76, y + 9, M + 270, y + 9);
  y += 20;
  drawText("Date", M, y, 7, font, GRAY);
  drawLine(M + 76, y + 9, M + 270, y + 9);

  // Footer
  drawRect(0, 746, PAGE_W, 46, TEAL);
  const compW = font.widthOfTextAtSize(cfg.companyName, 7);
  drawText(cfg.companyName, (PAGE_W - compW) / 2, 754, 7, font, CYAN);
  const contactStr = `${cfg.email}  ·  ${cfg.website}`;
  const contactW = font.widthOfTextAtSize(contactStr, 7);
  drawText(contactStr, (PAGE_W - contactW) / 2, 764, 7, font, WHITE);
  drawText("Page 1 of 1", M, 775, 6, font, WHITE);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
