import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

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

const SHIP_LABELS: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit",
  en_aduana: "In Customs", entregado: "Delivered",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.floor((Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000);
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ColDef = {
  label: string;
  get: (r: InvoiceRow) => string;
  w: number;
  right?: boolean;
};

const ALL_COLS: Record<string, ColDef> = {
  invoiceNumber: { label: "Invoice #",  get: r => r.invoiceNumber,                              w: 55 },
  clientName:    { label: "Client",     get: r => r.clientName,                                 w: 80 },
  supplierName:  { label: "Supplier",   get: r => r.supplierName,                               w: 70 },
  poNumber:      { label: "PO #",       get: r => r.poNumber || "—",                            w: 45 },
  product:       { label: "Product",    get: r => r.product ?? "—",                             w: 65 },
  destination:   { label: "Dest.",      get: r => r.destination ?? "—",                         w: 55 },
  date:          { label: "Date",       get: r => fmtDate(r.invoiceDate ?? r.shipmentDate),     w: 52 },
  dueDate:       { label: "Due Date",   get: r => fmtDate(r.dueDate),                           w: 52 },
  days:          { label: "Days",       get: r => { const d = daysOverdue(r.dueDate); return d <= 0 ? "—" : `${d}d`; }, w: 28, right: true },
  tons:          { label: "Tons",       get: r => r.quantityTons.toFixed(1),                    w: 38, right: true },
  amount:        { label: "Amount",     get: r => fmt$(r.revenue),                              w: 68, right: true },
  cost:          { label: "Cost",       get: r => fmt$(r.cost),                                 w: 68, right: true },
  profit:        { label: "Profit",     get: r => fmt$(r.profit),                               w: 68, right: true },
  margin:        { label: "Margin %",   get: r => (r.revenue > 0 ? ((r.profit/r.revenue)*100).toFixed(1) : "0") + "%", w: 44, right: true },
  shipStatus:    { label: "Status",     get: r => SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus, w: 50 },
  custPayment:   { label: "Payment",    get: r => r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid", w: 45 },
};

async function buildPdf(title: string, rows: InvoiceRow[], colKeys: string[], disposition: string): Promise<Buffer> {
  const TEAL = "#0d3d3b";
  const CYAN = "#4fd1c5";
  const DARK = "#1c1917";
  const GRAY = "#6b7280";
  const LGRY = "#f3f4f6";
  const RULE = "#d1d5db";

  const PAGE_W = 792;
  const PAGE_H = 612;
  const M = 40;
  const TABLE_W = PAGE_W - M * 2;
  const MAX_Y = PAGE_H - 52;

  // Filter to valid cols
  const cols = colKeys.filter(k => ALL_COLS[k]).map(k => ALL_COLS[k]);

  // Scale widths to fit table
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = TABLE_W / totalW;
  const widths = cols.map(c => Math.round(c.w * scale));
  widths[widths.length - 1] += TABLE_W - widths.reduce((s, w) => s + w, 0);

  // Logo
  const logoPath = path.join(process.cwd(), "public", "bza-logo-pdf.png");
  const logoExists = fs.existsSync(logoPath);

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], layout: "landscape", margin: 0, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const ready = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  function drawPageHeader() {
    // Top accent bar
    doc.rect(0, 0, PAGE_W, 3).fill(CYAN);

    // Logo or "BZA."
    if (logoExists) {
      doc.image(logoPath, M, M, { height: 28 });
    } else {
      doc.fontSize(20).font("Helvetica-Bold").fillColor(TEAL).text("BZA", M, M, { continued: true, lineBreak: false });
      doc.fillColor(CYAN).text(".", { lineBreak: false });
    }

    // Company info top-right
    const IX = 480;
    const IW = PAGE_W - M - IX;
    doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
    doc.text("BZA International Services, LLC", IX, M,      { width: IW, align: "right" });
    doc.text("1209 S. 10th St. Suite A #583",   IX, M + 10, { width: IW, align: "right" });
    doc.text("McAllen, TX 78501 US",            IX, M + 19, { width: IW, align: "right" });
    doc.text("ebazua@bza-is.com",               IX, M + 28, { width: IW, align: "right" });

    // Divider
    doc.moveTo(M, M + 42).lineTo(PAGE_W - M, M + 42).strokeColor(RULE).lineWidth(0.5).stroke();

    // Report title
    doc.fontSize(14).font("Helvetica-Bold").fillColor(TEAL).text(title, M, M + 50, { lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor(GRAY)
      .text(dateStr + "  ·  " + rows.length + " invoice" + (rows.length !== 1 ? "s" : ""), M, M + 68, { lineBreak: false });
  }

  let y = M + 82;
  drawPageHeader();

  function drawTableHeader() {
    doc.rect(M, y, TABLE_W, 15).fill(TEAL);
    let x = M + 3;
    cols.forEach((c, i) => {
      doc.fontSize(6).font("Helvetica-Bold").fillColor("white")
        .text(c.label, x, y + 4.5, { width: widths[i] - 3, align: c.right ? "right" : "left", lineBreak: false });
      x += widths[i];
    });
    y += 15;
  }
  drawTableHeader();

  let totTons = 0, totRev = 0, totCost = 0, totProfit = 0;

  rows.forEach((r, ri) => {
    if (y > MAX_Y) {
      doc.addPage();
      y = M;
      drawPageHeader();
      drawTableHeader();
    }
    if (ri % 2 === 0) doc.rect(M, y, TABLE_W, 13).fillColor(LGRY).fill();

    let x = M + 3;
    cols.forEach((c, i) => {
      const val = c.get(r);
      const isNeg = val.startsWith("-") || (val.startsWith("$") && val.includes("-"));
      doc.fontSize(6.5).font("Helvetica").fillColor(isNeg ? "#dc2626" : DARK)
        .text(val, x, y + 3, { width: widths[i] - 3, align: c.right ? "right" : "left", lineBreak: false, ellipsis: true });
      x += widths[i];
    });

    totTons += r.quantityTons;
    totRev += r.revenue;
    totCost += r.cost;
    totProfit += r.profit;
    y += 13;
  });

  // Totals row
  if (y + 16 > MAX_Y) { doc.addPage(); y = M; drawTableHeader(); }
  doc.moveTo(M, y).lineTo(PAGE_W - M, y).strokeColor(CYAN).lineWidth(1).stroke();
  y += 1;
  doc.rect(M, y, TABLE_W, 15).fill("#e8f5f3");
  let x = M + 3;
  const totals: Record<string, string> = {
    invoiceNumber: "TOTAL", tons: totTons.toFixed(1),
    amount: fmt$(totRev), cost: fmt$(totCost), profit: fmt$(totProfit),
    margin: totRev > 0 ? ((totProfit / totRev) * 100).toFixed(1) + "%" : "—",
  };
  cols.forEach((c, i) => {
    const colKey = Object.keys(ALL_COLS).find(k => ALL_COLS[k] === c) ?? "";
    const val = totals[colKey] ?? "";
    if (val) {
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor(TEAL)
        .text(val, x, y + 4, { width: widths[i] - 3, align: c.right ? "right" : "left", lineBreak: false });
    }
    x += widths[i];
  });
  y += 15;

  // Page footers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const fy = PAGE_H - 24;
    doc.moveTo(M, fy).lineTo(PAGE_W - M, fy).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.fontSize(6.5).font("Helvetica").fillColor(GRAY)
      .text("BZA International Services, LLC  ·  McAllen, TX  ·  Confidential", M, fy + 5, { align: "center", width: TABLE_W });
    doc.text(`Page ${i + 1} of ${pages.count}`, M, fy + 13, { align: "right", width: TABLE_W });
  }

  doc.end();
  return ready;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rows, title, cols, disposition = "inline" } = body as {
    rows: InvoiceRow[];
    title: string;
    cols: string[];
    disposition?: "inline" | "attachment";
  };

  if (!rows?.length || !cols?.length) {
    return NextResponse.json({ error: "Missing rows or cols" }, { status: 400 });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const safeTitle = (title || "Financial_Report").replace(/[^a-zA-Z0-9_]/g, "_");

  try {
    const buf = await buildPdf(title, rows, cols, disposition);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="BZA_${safeTitle}_${dateStr}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF error" }, { status: 500 });
  }
}
