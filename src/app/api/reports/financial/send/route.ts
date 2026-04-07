import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import * as XLSX from "xlsx";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

type InvoiceRow = {
  invoiceNumber: string;
  clientName: string;
  supplierName: string;
  poNumber: string;
  invoiceDate: string | null;
  shipmentDate: string | null;
  dueDate: string | null;
  quantityTons: number;
  revenue: number;
  costNoFreight: number;
  freight: number;
  cost: number;
  profit: number;
  customerPaymentStatus: string;
  supplierPaymentStatus: string;
  shipmentStatus: string;
  destination: string | null;
  product: string | null;
  transportType: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.floor((Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000);
}

const SHIP_LABELS: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit",
  en_aduana: "In Customs", entregado: "Delivered",
};

function buildExcel(title: string, rows: InvoiceRow[]): Buffer {
  const headers = [
    "Invoice #", "Client", "Supplier", "Product", "Destination",
    "Invoice Date", "Due Date", "Days Overdue", "Tons",
    "Revenue", "Cost", "Profit", "Margin %", "Ship Status", "Payment",
  ];

  const data = rows.map((r) => {
    const days = daysOverdue(r.dueDate);
    const margin = r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(2) : "0.00";
    return [
      r.invoiceNumber,
      r.clientName,
      r.supplierName,
      r.product ?? "",
      r.destination ?? "",
      fmtDate(r.invoiceDate),
      fmtDate(r.dueDate),
      days <= 0 ? "Not due" : days,
      +r.quantityTons.toFixed(3),
      +r.revenue.toFixed(2),
      +r.cost.toFixed(2),
      +r.profit.toFixed(2),
      +Number(margin),
      SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,
      r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid",
    ];
  });

  const totals = [
    "TOTAL", "", "", "", "", "", "", "",
    +rows.reduce((s, r) => s + r.quantityTons, 0).toFixed(3),
    +rows.reduce((s, r) => s + r.revenue, 0).toFixed(2),
    +rows.reduce((s, r) => s + r.cost, 0).toFixed(2),
    +rows.reduce((s, r) => s + r.profit, 0).toFixed(2),
    "", "", "",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, totals]);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...data.map((row) => String(row[i] ?? "").length)) + 2, 40),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ── Brand (matches /api/reports/financial/pdf) ────────────────────────────────
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

const COL_MAP_SEND: Record<string, { label: string; get: (r: InvoiceRow) => string; w: number; right?: boolean }> = {
  invoiceNumber: { label: "Invoice #",  get: r => r.invoiceNumber,                                                        w: 52 },
  clientName:    { label: "Client",     get: r => r.clientName,                                                           w: 130 },
  supplierName:  { label: "Supplier",   get: r => r.supplierName,                                                         w: 100 },
  poNumber:      { label: "PO #",       get: r => r.poNumber || "—",                                                      w: 46 },
  product:       { label: "Product",    get: r => r.product ?? "—",                                                       w: 90 },
  destination:   { label: "Dest.",      get: r => r.destination ?? "—",                                                   w: 55 },
  date:          { label: "Date",       get: r => fmtDate(r.invoiceDate ?? r.shipmentDate),                               w: 54 },
  dueDate:       { label: "Due Date",   get: r => fmtDate(r.dueDate),                                                     w: 54 },
  days:          { label: "Days",       get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : `${d}d`; },  w: 30, right: true },
  tons:          { label: "Tons",       get: r => r.quantityTons.toFixed(1),                                              w: 36, right: true },
  amount:        { label: "Amount",     get: r => "$" + r.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 }),  w: 68, right: true },
  cost:          { label: "Cost",       get: r => "$" + r.cost.toLocaleString("en-US",    { minimumFractionDigits: 2 }),  w: 68, right: true },
  profit:        { label: "Profit",     get: r => "$" + r.profit.toLocaleString("en-US",  { minimumFractionDigits: 2 }),  w: 68, right: true },
  margin:        { label: "Margin %",   get: r => (r.revenue > 0 ? ((r.profit/r.revenue)*100).toFixed(1) : "0") + "%",   w: 44, right: true },
  shipStatus:    { label: "Status",     get: r => SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,                      w: 52 },
  custPayment:   { label: "Payment",    get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid",                 w: 44 },
};

const AR_DEFAULT_COLS = ["invoiceNumber","clientName","product","date","dueDate","days","tons","amount","custPayment"];

function todayCSTSend(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function truncateSend(text: string, colW: number, bold = false): string {
  const pad      = 6;
  const charPx   = bold ? 3.8 : 3.5;
  const maxChars = Math.floor((colW - pad) / charPx);
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + "\u2026";
}

function drawCellSend(
  doc: typeof PDFDocument,
  text: string, x: number, y: number, w: number, rowH: number,
  opts: { right?: boolean; bold?: boolean; color?: string },
) {
  const pad  = 3;
  const cellW = Math.max(1, w - pad * 2);
  const safe  = truncateSend(text, w, opts.bold);
  doc.fontSize(6.5).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fillColor(opts.color ?? DARK)
    .text(safe, x + pad, y + Math.floor((rowH - 6.5) / 2), {
      width: cellW,
      align: opts.right ? "right" : "left",
      lineBreak: false,
    });
}

async function buildPdf(title: string, rows: InvoiceRow[], colKeys: string[]): Promise<Buffer> {
  const validKeys = colKeys.filter(k => COL_MAP_SEND[k]);
  const cols    = validKeys.map(k => COL_MAP_SEND[k]);
  const baseW   = cols.reduce((s, c) => s + c.w, 0);
  const widths  = cols.map(c => Math.floor(c.w * TW / baseW));
  widths[widths.length - 1] += TW - widths.reduce((s, w) => s + w, 0);

  const dateStr  = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const subtitle = `${dateStr}  ·  ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`;

  // No layout:'landscape' — explicit [792,612] is already landscape
  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const ready = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const MAX_Y = PAGE_H - 44;
  let pageNum = 1;

  // ── First page header ──
  function drawHeader(): number {
    doc.rect(0, 0, PAGE_W, 3).fill(CYAN);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL).text("BZA", M, M, { continued: true, lineBreak: false });
    doc.fillColor(CYAN).text(".", { lineBreak: false });
    const IX = 490, IW = PAGE_W - M - IX;
    doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
    doc.text("BZA International Services, LLC", IX, M,      { width: IW, align: "right" });
    doc.text("1209 S. 10th St. Suite A #583",   IX, M + 10, { width: IW, align: "right" });
    doc.text("McAllen, TX 78501 US",            IX, M + 20, { width: IW, align: "right" });
    doc.text("ebazua@bza-is.com",               IX, M + 30, { width: IW, align: "right" });
    const divY = M + 46;
    doc.moveTo(M, divY).lineTo(PAGE_W - M, divY).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.fontSize(13).font("Helvetica-Bold").fillColor(TEAL).text(title, M, divY + 8, { lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(subtitle, M, divY + 26, { lineBreak: false });
    return divY + 42;
  }

  function drawContHeader(): number {
    doc.rect(0, 0, PAGE_W, 2).fill(CYAN);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL).text(`${title}  (cont.)`, M, M, { lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(`Page ${pageNum}`, PAGE_W - M - 40, M, { width: 40, align: "right", lineBreak: false });
    return M + 18;
  }

  function drawTblHeader(y: number): number {
    doc.rect(M, y, TW, ROW_H).fill(TEAL);
    let x = M;
    cols.forEach((c, i) => { drawCellSend(doc, c.label, x, y, widths[i], ROW_H, { right: c.right, bold: true, color: "white" }); x += widths[i]; });
    return y + ROW_H;
  }

  let y = drawHeader();
  y = drawTblHeader(y);

  let totTons = 0, totRev = 0, totCost = 0, totProfit = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    if (y + ROW_H > MAX_Y) {
      doc.addPage(); pageNum++;
      y = drawContHeader();
      y = drawTblHeader(y);
    }
    if (ri % 2 === 0) doc.rect(M, y, TW, ROW_H).fillColor(LGRY).fill();
    let x = M;
    cols.forEach((c, i) => {
      drawCellSend(doc, c.get(r), x, y, widths[i], ROW_H, { right: c.right });
      x += widths[i];
    });
    totTons += r.quantityTons; totRev += r.revenue; totCost += r.cost; totProfit += r.profit;
    y += ROW_H;
  }

  // Totals
  const TOT_H = ROW_H + 2;
  if (y + TOT_H > MAX_Y) { doc.addPage(); pageNum++; y = drawContHeader(); }
  doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(CYAN).lineWidth(1).stroke();
  y += 1;
  doc.rect(M, y, TW, TOT_H).fill("#e0f5f2");
  const fmt$ = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totVals: Record<string, string> = {
    invoiceNumber: "TOTAL", tons: totTons.toFixed(1),
    amount: fmt$(totRev), cost: fmt$(totCost), profit: fmt$(totProfit),
    margin: totRev > 0 ? ((totProfit/totRev)*100).toFixed(1) + "%" : "—",
  };
  let x2 = M;
  validKeys.forEach((key, i) => {
    const val = totVals[key] ?? "";
    if (val) drawCellSend(doc, val, x2, y, widths[i], TOT_H, { right: COL_MAP_SEND[key].right, bold: true, color: TEAL });
    x2 += widths[i];
  });
  y += TOT_H;

  // Footers
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

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email not configured. Add SMTP_USER and SMTP_PASS in .env.local" },
      { status: 400 }
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
  const colKeys = cols?.length ? cols : AR_DEFAULT_COLS;

  if (!email || !rows?.length) {
    return NextResponse.json({ error: "Missing email or rows" }, { status: 400 });
  }

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const dateStr = todayCSTSend();
  const safeTitle = (title || "Financial_Report").replace(/[^a-zA-Z0-9_]/g, "_");

  if (format === "excel" || format === "both") {
    attachments.push({
      filename: `BZA_${safeTitle}_${dateStr}.xlsx`,
      content: buildExcel(title, rows),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  if (format === "pdf" || format === "both") {
    attachments.push({
      filename: `BZA_${safeTitle}_${dateStr}.pdf`,
      content: await buildPdf(title, rows, colKeys),
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
          <h2 style="color: #1e3a5f; margin-bottom: 4px;">BZA International Services</h2>
          <h3 style="color: #2563eb; font-size: 16px; margin-top: 0;">${title}</h3>
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
