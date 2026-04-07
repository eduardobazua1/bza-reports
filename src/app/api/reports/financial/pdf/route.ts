import { NextRequest, NextResponse } from "next/server";
import { getInvoices } from "@/server/queries";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ── Brand ──────────────────────────────────────────────────────────────────────
const TEAL = "#0d3d3b";
const CYAN = "#4fd1c5";
const DARK = "#1c1917";
const GRAY = "#6b7280";
const LGRY = "#f3f4f6";
const RULE = "#d1d5db";

const PAGE_W = 792;
const PAGE_H = 612;
const M      = 44;
const TW     = PAGE_W - M * 2;   // table width

const SHIP_LABELS: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit",
  en_aduana:  "In Customs", entregado:  "Delivered",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function daysOverdue(due: string | null): number {
  if (!due) return 0;
  return Math.floor((Date.now() - new Date(due + "T12:00:00").getTime()) / 86400000);
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Column catalogue ───────────────────────────────────────────────────────────
type Row = {
  invoiceNumber: string; clientName: string; supplierName: string; poNumber: string;
  invoiceDate: string | null; shipmentDate: string | null; dueDate: string | null;
  quantityTons: number; revenue: number; cost: number; profit: number;
  customerPaymentStatus: string; shipmentStatus: string;
  destination: string | null; product: string | null;
};

type ColDef = { label: string; get: (r: Row) => string; w: number; right?: boolean };

const COL_MAP: Record<string, ColDef> = {
  invoiceNumber: { label: "Invoice #",  get: r => r.invoiceNumber,                                    w: 55 },
  clientName:    { label: "Client",     get: r => r.clientName,                                       w: 85 },
  supplierName:  { label: "Supplier",   get: r => r.supplierName,                                     w: 75 },
  poNumber:      { label: "PO #",       get: r => r.poNumber || "—",                                  w: 46 },
  product:       { label: "Product",    get: r => r.product ?? "—",                                   w: 68 },
  destination:   { label: "Dest.",      get: r => r.destination ?? "—",                               w: 55 },
  date:          { label: "Date",       get: r => fmtDate(r.invoiceDate ?? r.shipmentDate),           w: 54 },
  dueDate:       { label: "Due Date",   get: r => fmtDate(r.dueDate),                                 w: 54 },
  days:          { label: "Days",       get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : `${d}d`; }, w: 30, right: true },
  tons:          { label: "Tons",       get: r => r.quantityTons.toFixed(1),                          w: 38, right: true },
  amount:        { label: "Amount",     get: r => fmt$(r.revenue),                                    w: 68, right: true },
  cost:          { label: "Cost",       get: r => fmt$(r.cost),                                       w: 68, right: true },
  profit:        { label: "Profit",     get: r => fmt$(r.profit),                                     w: 68, right: true },
  margin:        { label: "Margin %",   get: r => (r.revenue > 0 ? ((r.profit/r.revenue)*100).toFixed(1) : "0") + "%", w: 46, right: true },
  shipStatus:    { label: "Status",     get: r => SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,  w: 52 },
  custPayment:   { label: "Payment",    get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid", w: 46 },
};

// ── Row height constant ────────────────────────────────────────────────────────
const ROW_H = 16;

// ── Clipped cell text helper ───────────────────────────────────────────────────
function drawCell(
  doc: typeof PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  rowH: number,
  opts: { right?: boolean; bold?: boolean; color?: string },
) {
  const pad = 3;
  const cellX = x + pad;
  const cellW = Math.max(1, w - pad * 2);
  doc.save();
  doc.rect(cellX - 1, y, w, rowH).clip();
  doc
    .fontSize(6.5)
    .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
    .fillColor(opts.color ?? DARK)
    .text(text, cellX, y + Math.floor((rowH - 6.5) / 2), {
      width: cellW,
      align: opts.right ? "right" : "left",
      lineBreak: false,
      ellipsis: true,
    });
  doc.restore();
}

// ── Page helpers ───────────────────────────────────────────────────────────────
// Returns the y where table content should start on this page
function drawFullHeader(doc: typeof PDFDocument, title: string, subtitle: string): number {
  const y0 = M;

  // Top accent bar
  doc.rect(0, 0, PAGE_W, 3).fill(CYAN);

  // "BZA." wordmark
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL)
    .text("BZA", M, y0, { continued: true, lineBreak: false });
  doc.fillColor(CYAN).text(".", { lineBreak: false });

  // Company info – top right
  const IX = 490;
  const IW = PAGE_W - M - IX;
  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
  doc.text("BZA International Services, LLC", IX, y0,      { width: IW, align: "right" });
  doc.text("1209 S. 10th St. Suite A #583",   IX, y0 + 10, { width: IW, align: "right" });
  doc.text("McAllen, TX 78501 US",            IX, y0 + 20, { width: IW, align: "right" });
  doc.text("ebazua@bza-is.com",               IX, y0 + 30, { width: IW, align: "right" });

  // Divider
  const divY = y0 + 46;
  doc.moveTo(M, divY).lineTo(PAGE_W - M, divY).strokeColor(RULE).lineWidth(0.5).stroke();

  // Title + subtitle
  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEAL)
    .text(title, M, divY + 8, { lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(GRAY)
    .text(subtitle, M, divY + 26, { lineBreak: false });

  return divY + 42; // table starts here
}

function drawContinuationHeader(doc: typeof PDFDocument, title: string, page: number): number {
  doc.rect(0, 0, PAGE_W, 2).fill(CYAN);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL)
    .text(`${title}  (cont.)`, M, M, { lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(GRAY)
    .text(`Page ${page}`, PAGE_W - M - 40, M, { width: 40, align: "right", lineBreak: false });
  return M + 18;
}

function drawTableHeader(doc: typeof PDFDocument, y: number, cols: ColDef[], widths: number[]) {
  const H = ROW_H;
  doc.rect(M, y, TW, H).fill(TEAL);
  let x = M;
  cols.forEach((c, i) => {
    drawCell(doc, c.label, x, y, widths[i], H, { right: c.right, bold: true, color: "white" });
    x += widths[i];
  });
  return y + H;
}

// ── Main PDF builder ───────────────────────────────────────────────────────────
async function buildPdf(
  rows: Row[],
  title: string,
  colKeys: string[],
  disposition: string,
): Promise<Buffer> {
  const validKeys = colKeys.filter(k => COL_MAP[k]);
  const cols    = validKeys.map(k => COL_MAP[k]);

  // Scale column widths proportionally to table width
  const baseW  = cols.reduce((s, c) => s + c.w, 0);
  const scale  = TW / baseW;
  const widths = cols.map(c => Math.floor(c.w * scale));
  // Fix rounding remainder on last column
  widths[widths.length - 1] += TW - widths.reduce((s, w) => s + w, 0);

  const dateStr  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const subtitle = `${dateStr}  ·  ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`;

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const ready = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  let pageNum = 1;
  const MAX_Y = PAGE_H - 44; // leave room for footer

  // First page header
  let y = drawFullHeader(doc, title, subtitle);
  y = drawTableHeader(doc, y, cols, widths);

  let totTons = 0, totRev = 0, totCost = 0, totProfit = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];

    // New page
    if (y + ROW_H > MAX_Y) {
      doc.addPage();
      pageNum++;
      y = drawContinuationHeader(doc, title, pageNum);
      y = drawTableHeader(doc, y, cols, widths);
    }

    // Alternating row bg
    if (ri % 2 === 0) doc.rect(M, y, TW, ROW_H).fillColor(LGRY).fill();

    let x = M;
    cols.forEach((c, i) => {
      const val   = c.get(r);
      const isNeg = c.right && val.startsWith("$") && r.profit < 0 && c.label === "Profit";
      drawCell(doc, val, x, y, widths[i], ROW_H, { right: c.right, color: isNeg ? "#dc2626" : DARK });
      x += widths[i];
    });

    totTons += r.quantityTons;
    totRev  += r.revenue;
    totCost += r.cost;
    totProfit += r.profit;
    y += ROW_H;
  }

  // Totals row
  const TOT_H = ROW_H + 2;
  if (y + TOT_H > MAX_Y) {
    doc.addPage();
    pageNum++;
    y = drawContinuationHeader(doc, title, pageNum);
  }
  doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(CYAN).lineWidth(1).stroke();
  y += 1;
  doc.rect(M, y, TW, TOT_H).fill("#e0f5f2");
  const totVals: Record<string, string> = {
    invoiceNumber: "TOTAL",
    tons:   totTons.toFixed(1),
    amount: fmt$(totRev),
    cost:   fmt$(totCost),
    profit: fmt$(totProfit),
    margin: totRev > 0 ? ((totProfit / totRev) * 100).toFixed(1) + "%" : "—",
  };
  let x2 = M;
  validKeys.forEach((key, i) => {
    const val = totVals[key] ?? "";
    if (val) {
      drawCell(doc, val, x2, y, widths[i], TOT_H, { right: COL_MAP[key].right, bold: true, color: TEAL });
    }
    x2 += widths[i];
  });
  y += TOT_H;

  // Page footers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const fy = PAGE_H - 22;
    doc.moveTo(M, fy).lineTo(PAGE_W - M, fy).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.fontSize(6.5).font("Helvetica").fillColor(GRAY)
      .text("BZA International Services, LLC  ·  McAllen, TX  ·  Confidential", M, fy + 5, { align: "center", width: TW });
    doc.text(`Page ${i + 1} of ${range.count}`, M, fy + 5, { align: "right", width: TW });
  }

  doc.end();
  return ready;
}

// ── Route handler (GET) ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp          = req.nextUrl.searchParams;
  const tab         = sp.get("tab") ?? "ar-aging";
  const colKeys     = (sp.get("cols") ?? "invoiceNumber,clientName,product,date,dueDate,days,tons,amount,custPayment").split(",").filter(Boolean);
  const dateFrom    = sp.get("dateFrom") ?? "";
  const dateTo      = sp.get("dateTo")   ?? "";
  const disposition = sp.get("disposition") ?? "inline";

  const allRows = await getInvoices();

  const data: Row[] = allRows.map(row => {
    const sellPrice  = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice   = row.invoice.buyPriceOverride  ?? row.poBuyPrice  ?? 0;
    const revenue    = row.invoice.quantityTons * sellPrice;
    const costNoFrt  = row.invoice.quantityTons * buyPrice;
    const freight    = row.invoice.freightCost ?? 0;
    const cost       = costNoFrt + freight;
    const profit     = revenue - cost;
    const terms      = row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays : (row.clientPaymentTermsDays ?? 60);
    const base = row.invoice.invoiceDate || row.invoice.shipmentDate;
    let dueDate: string | null = null;
    if (base) {
      const d = new Date(base + "T12:00:00");
      d.setDate(d.getDate() + terms);
      dueDate = d.toISOString().split("T")[0];
    }
    return {
      invoiceNumber:        row.invoice.invoiceNumber,
      clientName:           row.clientName           ?? "Unknown",
      supplierName:         row.supplierName         ?? "Unknown",
      poNumber:             row.poNumber             ?? "",
      invoiceDate:          row.invoice.invoiceDate,
      shipmentDate:         row.invoice.shipmentDate,
      dueDate,
      quantityTons:         row.invoice.quantityTons,
      revenue, cost, profit,
      customerPaymentStatus: row.invoice.customerPaymentStatus,
      supplierPaymentStatus: row.invoice.supplierPaymentStatus,
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

  // For AR aging only show unpaid
  const rows = tab === "ar-aging" ? data.filter(r => r.customerPaymentStatus === "unpaid") : data;

  const LABELS: Record<string, string> = {
    "ar-aging":    "Accounts Receivable Aging",
    "pl-monthly":  "Profit and Loss by Month",
    "pl-customer": "Profit and Loss by Customer",
    "pl-supplier": "Profit and Loss by Supplier",
  };
  const title = LABELS[tab] ?? "Financial Report";

  const dateStr = new Date().toISOString().split("T")[0];
  const safeTitle = title.replace(/[^a-zA-Z0-9_]/g, "_");

  try {
    const buf = await buildPdf(rows, title, colKeys, disposition);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="BZA_${safeTitle}_${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF error" }, { status: 500 });
  }
}
