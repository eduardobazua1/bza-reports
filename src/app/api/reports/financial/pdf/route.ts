import { NextRequest, NextResponse } from "next/server";
import { getInvoices } from "@/server/queries";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";

// ── Constants ──────────────────────────────────────────────────────────────────
const PAGE_W = 792, PAGE_H = 612, M = 44, TW = PAGE_W - M * 2, ROW_H = 16;

// pdf-lib: y=0 is bottom of page. Helper to flip pdfkit-style y (top-origin).
const BY = (pkY: number) => PAGE_H - pkY;          // point
const RY = (pkY: number, h: number) => PAGE_H - pkY - h; // rect bottom-left y

type RGB = ReturnType<typeof rgb>;

function hx(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const C_TEAL = hx("#0d3d3b"), C_CYAN = hx("#4fd1c5"), C_DARK = hx("#1c1917");
const C_GRAY = hx("#6b7280"), C_LGRY = hx("#f3f4f6"), C_RULE = hx("#d1d5db");
const C_WHITE = rgb(1, 1, 1), C_RED = hx("#dc2626"), C_TOTBG = hx("#e0f5f2");

const SHIP_LABELS: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit",
  en_aduana: "In Customs", entregado: "Delivered",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function todayCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
function daysOverdue(due: string | null): number {
  if (!due) return 0;
  return Math.floor((new Date(todayCST() + "T00:00:00").getTime() - new Date(due + "T00:00:00").getTime()) / 86400000);
}
function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Row = {
  invoiceNumber: string; clientName: string; supplierName: string; poNumber: string;
  invoiceDate: string | null; shipmentDate: string | null; dueDate: string | null;
  quantityTons: number; revenue: number; cost: number; profit: number;
  customerPaymentStatus: string; shipmentStatus: string;
  destination: string | null; product: string | null;
};

type ColDef = { label: string; get: (r: Row) => string; w: number; right?: boolean };

const COL_MAP: Record<string, ColDef> = {
  invoiceNumber: { label: "Invoice #", get: r => r.invoiceNumber,                                    w: 52 },
  clientName:    { label: "Client",    get: r => r.clientName,                                       w: 130 },
  supplierName:  { label: "Supplier",  get: r => r.supplierName,                                     w: 100 },
  poNumber:      { label: "PO #",      get: r => r.poNumber || "—",                                  w: 46 },
  product:       { label: "Product",   get: r => r.product ?? "—",                                   w: 90 },
  destination:   { label: "Dest.",     get: r => r.destination ?? "—",                               w: 55 },
  date:          { label: "Date",      get: r => fmtDate(r.invoiceDate ?? r.shipmentDate),           w: 54 },
  dueDate:       { label: "Due Date",  get: r => fmtDate(r.dueDate),                                w: 54 },
  days:          { label: "Days",      get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : `${d}d`; }, w: 30, right: true },
  tons:          { label: "Tons",      get: r => r.quantityTons.toFixed(1),                          w: 36, right: true },
  amount:        { label: "Amount",    get: r => fmt$(r.revenue),                                    w: 68, right: true },
  cost:          { label: "Cost",      get: r => fmt$(r.cost),                                       w: 68, right: true },
  profit:        { label: "Profit",    get: r => fmt$(r.profit),                                     w: 68, right: true },
  margin:        { label: "Margin %",  get: r => (r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : "0") + "%", w: 44, right: true },
  shipStatus:    { label: "Status",    get: r => SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,  w: 52 },
  custPayment:   { label: "Payment",   get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid", w: 44 },
};

// ── Drawing ────────────────────────────────────────────────────────────────────
function fillRect(page: PDFPage, x: number, pkY: number, w: number, h: number, color: RGB) {
  page.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
}

function hline(page: PDFPage, x1: number, pkY: number, x2: number, color: RGB, thickness: number) {
  page.drawLine({ start: { x: x1, y: BY(pkY) }, end: { x: x2, y: BY(pkY) }, thickness, color });
}

function fitText(text: string, maxW: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + "\u2026", size) > maxW) s = s.slice(0, -1);
  return s + "\u2026";
}

// Place text with pdfkit-style y (top of text), centered vertically in rowH
function drawCell(
  page: PDFPage, text: string, x: number, pkY: number, w: number, rowH: number,
  opts: { font: PDFFont; size: number; color: RGB; right?: boolean },
) {
  const { font, size, color, right } = opts;
  const pad = 3;
  const inner = w - pad * 2;
  const str = fitText(text, inner, font, size);
  const tw = font.widthOfTextAtSize(str, size);
  const drawX = right ? x + w - pad - tw : x + pad;
  // Baseline: center cap-height in row. Helvetica cap-height ≈ size * 0.716
  const capH = size * 0.716;
  const rowMidY = BY(pkY) - rowH / 2;   // pdf-lib y of row vertical center
  const baselineY = rowMidY - capH / 2;
  page.drawText(str, { x: drawX, y: baselineY, size, font, color });
}

function drawHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  title: string, subtitle: string,
): number {
  // Top cyan bar
  fillRect(page, 0, 0, PAGE_W, 3, C_CYAN);

  // "BZA." logo
  const y0 = M;
  const bzaW = fonts.bold.widthOfTextAtSize("BZA", 22);
  page.drawText("BZA", { x: M, y: BY(y0) - 22 * 0.716, size: 22, font: fonts.bold, color: C_TEAL });
  page.drawText(".", { x: M + bzaW, y: BY(y0) - 22 * 0.716, size: 22, font: fonts.bold, color: C_CYAN });

  // Company info (right side)
  const IX = 490;
  const lines = [
    "BZA International Services, LLC",
    "1209 S. 10th St. Suite A #583",
    "McAllen, TX 78501 US",
    "ebazua@bza-is.com",
  ];
  const s = 6.5;
  lines.forEach((line, i) => {
    const lw = fonts.regular.widthOfTextAtSize(line, s);
    const lx = PAGE_W - M - lw;
    const ly = BY(y0 + i * 10) - s * 0.716;
    page.drawText(line, { x: lx, y: ly, size: s, font: fonts.regular, color: C_GRAY });
  });

  // Divider
  const divY = y0 + 46;
  hline(page, M, divY, PAGE_W - M, C_RULE, 0.5);

  // Title
  page.drawText(title, { x: M, y: BY(divY + 8) - 13 * 0.716, size: 13, font: fonts.bold, color: C_TEAL });

  // Subtitle
  page.drawText(subtitle, { x: M, y: BY(divY + 26) - 7 * 0.716, size: 7, font: fonts.regular, color: C_GRAY });

  return divY + 42;
}

function drawContHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  title: string, pageNum: number,
): number {
  fillRect(page, 0, 0, PAGE_W, 2, C_CYAN);
  page.drawText(`${title}  (cont.)`, { x: M, y: BY(M) - 8 * 0.716, size: 8, font: fonts.bold, color: C_TEAL });
  const pgStr = `Page ${pageNum}`;
  const pgW = fonts.regular.widthOfTextAtSize(pgStr, 7);
  page.drawText(pgStr, { x: PAGE_W - M - pgW, y: BY(M) - 7 * 0.716, size: 7, font: fonts.regular, color: C_GRAY });
  return M + 18;
}

function drawTblHeader(
  page: PDFPage, fonts: { bold: PDFFont; regular: PDFFont },
  pkY: number, cols: ColDef[], widths: number[],
): number {
  fillRect(page, M, pkY, TW, ROW_H, C_TEAL);
  let x = M;
  cols.forEach((c, i) => {
    drawCell(page, c.label, x, pkY, widths[i], ROW_H, { font: fonts.bold, size: 6.5, color: C_WHITE, right: c.right });
    x += widths[i];
  });
  return pkY + ROW_H;
}

// ── Build PDF ──────────────────────────────────────────────────────────────────
async function buildPdf(rows: Row[], title: string, colKeys: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold: boldFont, regular: regularFont };

  const validKeys = colKeys.filter(k => COL_MAP[k]);
  const cols = validKeys.map(k => COL_MAP[k]);
  const baseW = cols.reduce((s, c) => s + c.w, 0);
  const widths = cols.map(c => Math.floor(c.w * TW / baseW));
  widths[widths.length - 1] += TW - widths.reduce((s, w) => s + w, 0);

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const subtitle = `${dateStr}  ·  ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`;

  const MAX_Y = PAGE_H - 44;
  let pageNum = 1;

  const addPage = () => pdfDoc.addPage([PAGE_W, PAGE_H]);

  let page = addPage();
  let y = drawHeader(page, fonts, title, subtitle);
  y = drawTblHeader(page, fonts, y, cols, widths);

  let totTons = 0, totRev = 0, totCost = 0, totProfit = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    if (y + ROW_H > MAX_Y) {
      page = addPage(); pageNum++;
      y = drawContHeader(page, fonts, title, pageNum);
      y = drawTblHeader(page, fonts, y, cols, widths);
    }
    if (ri % 2 === 0) fillRect(page, M, y, TW, ROW_H, C_LGRY);
    let x = M;
    cols.forEach((c, i) => {
      const val = c.get(r);
      const isNeg = c.right && val.startsWith("$") && r.profit < 0 && c.label === "Profit";
      drawCell(page, val, x, y, widths[i], ROW_H, { font: regularFont, size: 6.5, color: isNeg ? C_RED : C_DARK, right: c.right });
      x += widths[i];
    });
    totTons += r.quantityTons; totRev += r.revenue; totCost += r.cost; totProfit += r.profit;
    y += ROW_H;
  }

  // Totals row
  const TOT_H = ROW_H + 2;
  if (y + TOT_H > MAX_Y) { page = addPage(); pageNum++; y = drawContHeader(page, fonts, title, pageNum); }
  hline(page, M, y, PAGE_W - M, C_CYAN, 1);
  y += 1;
  fillRect(page, M, y, TW, TOT_H, C_TOTBG);
  const totVals: Record<string, string> = {
    invoiceNumber: "TOTAL", tons: totTons.toFixed(1),
    amount: fmt$(totRev), cost: fmt$(totCost), profit: fmt$(totProfit),
    margin: totRev > 0 ? ((totProfit / totRev) * 100).toFixed(1) + "%" : "—",
  };
  let x2 = M;
  validKeys.forEach((key, i) => {
    const val = totVals[key] ?? "";
    if (val) drawCell(page, val, x2, y, widths[i], TOT_H, { font: boldFont, size: 6.5, color: C_TEAL, right: COL_MAP[key].right });
    x2 += widths[i];
  });

  // Footer on every page
  const pages = pdfDoc.getPages();
  const total = pages.length;
  pages.forEach((pg, i) => {
    const fy = PAGE_H - 22;
    hline(pg, M, fy, PAGE_W - M, C_RULE, 0.5);
    const footer = "BZA International Services, LLC  ·  McAllen, TX  ·  Confidential";
    const fw = regularFont.widthOfTextAtSize(footer, 6.5);
    pg.drawText(footer, { x: M + (TW - fw) / 2, y: BY(fy + 12) - 6.5 * 0.716, size: 6.5, font: regularFont, color: C_GRAY });
    const pgStr = `Page ${i + 1} of ${total}`;
    const pw = regularFont.widthOfTextAtSize(pgStr, 6.5);
    pg.drawText(pgStr, { x: PAGE_W - M - pw, y: BY(fy + 12) - 6.5 * 0.716, size: 6.5, font: regularFont, color: C_GRAY });
  });

  return pdfDoc.save();
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
  const sp          = req.nextUrl.searchParams;
  const tab         = sp.get("tab") ?? "ar-aging";
  const colKeys     = (sp.get("cols") ?? "invoiceNumber,clientName,product,date,dueDate,days,tons,amount,custPayment").split(",").filter(Boolean);
  const dateFrom    = sp.get("dateFrom") ?? "";
  const dateTo      = sp.get("dateTo")   ?? "";
  const disposition = sp.get("disposition") ?? "inline";

  const allRows = await getInvoices();

  const data: Row[] = allRows.map(row => {
    const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice  = row.invoice.buyPriceOverride  ?? row.poBuyPrice  ?? 0;
    const revenue   = row.invoice.quantityTons * sellPrice;
    const cost      = row.invoice.quantityTons * buyPrice + (row.invoice.freightCost ?? 0);
    const profit    = revenue - cost;
    const terms     = row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays : (row.clientPaymentTermsDays ?? 60);
    const base = row.invoice.invoiceDate || row.invoice.shipmentDate;
    let dueDate: string | null = null;
    if (base) {
      const d = new Date(base + "T12:00:00");
      d.setDate(d.getDate() + terms);
      dueDate = d.toISOString().split("T")[0];
    }
    return {
      invoiceNumber:         row.invoice.invoiceNumber,
      clientName:            row.clientName           ?? "Unknown",
      supplierName:          row.supplierName         ?? "Unknown",
      poNumber:              row.poNumber             ?? "",
      invoiceDate:           row.invoice.invoiceDate,
      shipmentDate:          row.invoice.shipmentDate,
      dueDate,
      quantityTons:          row.invoice.quantityTons,
      revenue, cost, profit,
      customerPaymentStatus: row.invoice.customerPaymentStatus,
      shipmentStatus:        row.invoice.shipmentStatus,
      destination:           row.invoice.destination,
      product:               row.invoice.item ?? row.product,
    };
  }).filter(r => {
    const d = r.invoiceDate || r.shipmentDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo   && d && d > dateTo)   return false;
    return true;
  });

  const rows = tab === "ar-aging" ? data.filter(r => r.customerPaymentStatus === "unpaid") : data;

  const LABELS: Record<string, string> = {
    "ar-aging":    "Accounts Receivable Aging",
    "pl-monthly":  "Profit and Loss by Month",
    "pl-customer": "Profit and Loss by Customer",
    "pl-supplier": "Profit and Loss by Supplier",
  };
  const title      = LABELS[tab] ?? "Financial Report";
  const safeTitle  = title.replace(/[^a-zA-Z0-9_]/g, "_");

    const buf = await buildPdf(rows, title, colKeys);
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="BZA_${safeTitle}_${todayCST()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return new NextResponse(`PDF generation failed:\n\n${msg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
