import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import * as XLSX from "xlsx";
import { AR_DEFAULT_COLS } from "@/lib/financial-pdf";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// ── Brand ──────────────────────────────────────────────────────────────────────
const TEAL = "#0d3d3b";
const CYAN  = "#4fd1c5";
const DARK  = "#1c1917";
const GRAY  = "#6b7280";
const LGRY  = "#f3f4f6";
const RULE  = "#d1d5db";
const PAGE_W = 792;
const PAGE_H = 612;
const M      = 44;
const TW     = PAGE_W - M * 2;
const ROW_H  = 16;

const SHIP_LABELS: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit",
  en_aduana: "In Customs", entregado: "Delivered",
};

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

function truncate(text: string, colW: number, bold = false): string {
  const maxChars = Math.floor((colW - 6) / (bold ? 3.8 : 3.5));
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + "\u2026";
}

type Row = {
  invoiceNumber: string; clientName: string; supplierName: string; poNumber: string;
  invoiceDate: string | null; shipmentDate: string | null; dueDate: string | null;
  quantityTons: number; revenue: number; cost: number; profit: number;
  customerPaymentStatus: string; shipmentStatus: string;
  destination: string | null; product: string | null;
};

type ColDef = { label: string; get: (r: Row) => string; w: number; right?: boolean };

const COL_MAP: Record<string, ColDef> = {
  invoiceNumber: { label: "Invoice #",  get: r => r.invoiceNumber,                                    w: 52 },
  clientName:    { label: "Client",     get: r => r.clientName,                                       w: 130 },
  supplierName:  { label: "Supplier",   get: r => r.supplierName,                                     w: 100 },
  poNumber:      { label: "PO #",       get: r => r.poNumber || "—",                                  w: 46 },
  product:       { label: "Product",    get: r => r.product ?? "—",                                   w: 90 },
  destination:   { label: "Dest.",      get: r => r.destination ?? "—",                               w: 55 },
  date:          { label: "Date",       get: r => fmtDate(r.invoiceDate ?? r.shipmentDate),           w: 54 },
  dueDate:       { label: "Due Date",   get: r => fmtDate(r.dueDate),                                w: 54 },
  days:          { label: "Days",       get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : `${d}d`; }, w: 30, right: true },
  tons:          { label: "Tons",       get: r => r.quantityTons.toFixed(1),                          w: 36, right: true },
  amount:        { label: "Amount",     get: r => fmt$(r.revenue),                                    w: 68, right: true },
  cost:          { label: "Cost",       get: r => fmt$(r.cost),                                       w: 68, right: true },
  profit:        { label: "Profit",     get: r => fmt$(r.profit),                                     w: 68, right: true },
  margin:        { label: "Margin %",   get: r => (r.revenue > 0 ? ((r.profit/r.revenue)*100).toFixed(1) : "0") + "%", w: 44, right: true },
  shipStatus:    { label: "Status",     get: r => SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,  w: 52 },
  custPayment:   { label: "Payment",    get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid", w: 44 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawCell(doc: any, text: string, x: number, y: number, w: number, rowH: number,
  opts: { right?: boolean; bold?: boolean; color?: string }) {
  const pad = 3;
  doc.fontSize(6.5).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fillColor(opts.color ?? DARK)
    .text(truncate(text, w, opts.bold), x + pad, y + Math.floor((rowH - 6.5) / 2), {
      width: Math.max(1, w - pad * 2), align: opts.right ? "right" : "left", lineBreak: false,
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawHeader(doc: any, title: string, subtitle: string): number {
  const y0 = M;
  doc.rect(0, 0, PAGE_W, 3).fill(CYAN);
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL).text("BZA", M, y0, { continued: true, lineBreak: false });
  doc.fillColor(CYAN).text(".", { lineBreak: false });
  const IX = 490, IW = PAGE_W - M - IX;
  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
  doc.text("BZA International Services, LLC", IX, y0,      { width: IW, align: "right" });
  doc.text("1209 S. 10th St. Suite A #583",   IX, y0 + 10, { width: IW, align: "right" });
  doc.text("McAllen, TX 78501 US",            IX, y0 + 20, { width: IW, align: "right" });
  doc.text("ebazua@bza-is.com",               IX, y0 + 30, { width: IW, align: "right" });
  const divY = y0 + 46;
  doc.moveTo(M, divY).lineTo(PAGE_W - M, divY).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEAL).text(title, M, divY + 8, { lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(subtitle, M, divY + 26, { lineBreak: false });
  return divY + 42;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawContHeader(doc: any, title: string, pageNum: number): number {
  doc.rect(0, 0, PAGE_W, 2).fill(CYAN);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL).text(`${title}  (cont.)`, M, M, { lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(`Page ${pageNum}`, PAGE_W - M - 40, M, { width: 40, align: "right", lineBreak: false });
  return M + 18;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawTblHeader(doc: any, y: number, cols: ColDef[], widths: number[]): number {
  doc.rect(M, y, TW, ROW_H).fill(TEAL);
  let x = M;
  cols.forEach((c, i) => { drawCell(doc, c.label, x, y, widths[i], ROW_H, { bold: true, color: "white", right: c.right }); x += widths[i]; });
  return y + ROW_H;
}

async function buildPdf(rows: Row[], title: string, colKeys: string[]): Promise<Buffer> {
  const validKeys = colKeys.filter(k => COL_MAP[k]);
  const cols      = validKeys.map(k => COL_MAP[k]);
  const baseW     = cols.reduce((s, c) => s + c.w, 0);
  const widths    = cols.map(c => Math.floor(c.w * TW / baseW));
  widths[widths.length - 1] += TW - widths.reduce((s, w) => s + w, 0);

  const dateStr  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const subtitle = `${dateStr}  ·  ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`;

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const ready = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  let pageNum = 1;
  const MAX_Y = PAGE_H - 44;
  let y = drawHeader(doc, title, subtitle);
  y = drawTblHeader(doc, y, cols, widths);

  let totTons = 0, totRev = 0, totCost = 0, totProfit = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    if (y + ROW_H > MAX_Y) {
      doc.addPage(); pageNum++;
      y = drawContHeader(doc, title, pageNum);
      y = drawTblHeader(doc, y, cols, widths);
    }
    if (ri % 2 === 0) doc.rect(M, y, TW, ROW_H).fillColor(LGRY).fill();
    let x = M;
    cols.forEach((c, i) => {
      const val = c.get(r);
      const isNeg = c.right && val.startsWith("$") && r.profit < 0 && c.label === "Profit";
      drawCell(doc, val, x, y, widths[i], ROW_H, { right: c.right, color: isNeg ? "#dc2626" : DARK });
      x += widths[i];
    });
    totTons += r.quantityTons; totRev += r.revenue; totCost += r.cost; totProfit += r.profit;
    y += ROW_H;
  }

  const TOT_H = ROW_H + 2;
  if (y + TOT_H > MAX_Y) { doc.addPage(); pageNum++; y = drawContHeader(doc, title, pageNum); }
  doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(CYAN).lineWidth(1).stroke();
  y += 1;
  doc.rect(M, y, TW, TOT_H).fill("#e0f5f2");
  const totVals: Record<string, string> = {
    invoiceNumber: "TOTAL", tons: totTons.toFixed(1),
    amount: fmt$(totRev), cost: fmt$(totCost), profit: fmt$(totProfit),
    margin: totRev > 0 ? ((totProfit/totRev)*100).toFixed(1) + "%" : "—",
  };
  let x2 = M;
  validKeys.forEach((key, i) => {
    const val = totVals[key] ?? "";
    if (val) drawCell(doc, val, x2, y, widths[i], TOT_H, { right: COL_MAP[key].right, bold: true, color: TEAL });
    x2 += widths[i];
  });
  y += TOT_H;

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

type InvoiceRow = Row & {
  costNoFreight?: number;
  freight?: number;
  supplierPaymentStatus?: string;
  transportType?: string;
};

// ── Excel builder — respects selected columns ──────────────────────────────────
const EXCEL_COL: Record<string, { header: string; get: (r: InvoiceRow) => string | number }> = {
  invoiceNumber: { header: "Invoice #",  get: r => r.invoiceNumber },
  clientName:    { header: "Client",     get: r => r.clientName },
  supplierName:  { header: "Supplier",   get: r => r.supplierName },
  poNumber:      { header: "PO #",       get: r => r.poNumber || "—" },
  product:       { header: "Product",    get: r => r.product ?? "—" },
  destination:   { header: "Dest.",      get: r => r.destination ?? "—" },
  date:          { header: "Date",       get: r => fmtDate(r.invoiceDate ?? r.shipmentDate) },
  dueDate:       { header: "Due Date",   get: r => fmtDate(r.dueDate) },
  days:          { header: "Days",       get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : d; } },
  tons:          { header: "Tons",       get: r => +r.quantityTons.toFixed(3) },
  amount:        { header: "Amount",     get: r => +r.revenue.toFixed(2) },
  cost:          { header: "Cost",       get: r => +r.cost.toFixed(2) },
  profit:        { header: "Profit",     get: r => +r.profit.toFixed(2) },
  margin:        { header: "Margin %",   get: r => r.revenue > 0 ? +((r.profit/r.revenue)*100).toFixed(2) : 0 },
  shipStatus:    { header: "Status",     get: r => r.shipmentStatus },
  custPayment:   { header: "Payment",    get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid" },
};

function buildExcel(title: string, rows: InvoiceRow[], colKeys: string[]): Buffer {
  const validKeys = colKeys.filter(k => EXCEL_COL[k]);
  const headers   = validKeys.map(k => EXCEL_COL[k].header);
  const data      = rows.map(r => validKeys.map(k => EXCEL_COL[k].get(r)));

  // Totals row — numeric columns only
  const numericKeys = new Set(["tons","amount","cost","profit"]);
  const totals = validKeys.map(k => {
    if (k === "invoiceNumber") return "TOTAL";
    if (numericKeys.has(k)) return +rows.reduce((s, r) => s + (EXCEL_COL[k].get(r) as number), 0).toFixed(2);
    return "";
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, totals]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map(row => String(row[i] ?? "").length)) + 2, 40),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email not configured. Add SMTP_USER and SMTP_PASS in .env.local" },
      { status: 400 },
    );
  }

  const body = await req.json();
  const { email, subject, message, title, rows, cols, format } = body as {
    email: string;
    subject: string;
    message: string;
    title: string;
    rows: InvoiceRow[];
    cols?: string[];
    format: "excel" | "pdf" | "both";
  };

  if (!email || !rows?.length) {
    return NextResponse.json({ error: "Missing email or rows" }, { status: 400 });
  }

  const colKeys = cols?.length ? cols : AR_DEFAULT_COLS;

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const dateStr   = todayCST();
  const safeTitle = (title || "Financial_Report").replace(/[^a-zA-Z0-9_]/g, "_");

  if (format === "excel" || format === "both") {
    attachments.push({
      filename: `BZA_${safeTitle}_${dateStr}.xlsx`,
      content:  buildExcel(title, rows, colKeys),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  if (format === "pdf" || format === "both") {
    attachments.push({
      filename: `BZA_${safeTitle}_${dateStr}.pdf`,
      content:  await buildPdf(rows, title, colKeys),
      contentType: "application/pdf",
    });
  }

  const fmtLabel = format === "both" ? "PDF and Excel" : format === "pdf" ? "PDF" : "Excel";

  try {
    await sendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d3d3b; margin-bottom: 4px;">BZA International Services</h2>
          <h3 style="color: #4fd1c5; font-size: 16px; margin-top: 0;">${title}</h3>
          ${message ? `<p style="color: #333; line-height: 1.6;">${message.replace(/\n/g, "<br>")}</p>` : ""}
          <p style="color: #666; font-size: 13px;">
            Please find the ${fmtLabel} report attached.
            (${rows.length} invoice${rows.length !== 1 ? "s" : ""})
          </p>
          <p style="color: #999; font-size: 11px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;">
            BZA International Services, LLC<br>
            1209 S. 10th St. Suite #583, McAllen, TX 78501
          </p>
        </div>
      `,
      attachments,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send email: ${msg}` }, { status: 400 });
  }
}
