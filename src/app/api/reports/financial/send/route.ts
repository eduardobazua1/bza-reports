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

async function buildPdf(title: string, rows: InvoiceRow[]): Promise<Buffer> {
  const DARK = "#1e3a5f";
  const BLUE = "#2563eb";
  const LIGHT = "#f0f4ff";
  const GRAY = "#666666";
  const WHITE = "#ffffff";
  const MARGIN = 40;
  const PAGE_W = 792;
  const PAGE_H = 612;
  const TABLE_W = PAGE_W - MARGIN * 2;
  const MAX_Y = PAGE_H - 60;

  const cols = [
    { key: "invoiceNumber",           header: "Invoice #",  w: 55 },
    { key: "clientName",              header: "Client",     w: 90 },
    { key: "product",                 header: "Product",    w: 65 },
    { key: "destination",             header: "Dest.",      w: 60 },
    { key: "invoiceDate",             header: "Inv. Date",  w: 55 },
    { key: "dueDate",                 header: "Due Date",   w: 55 },
    { key: "days",                    header: "Days",       w: 32 },
    { key: "quantityTons",            header: "Tons",       w: 40 },
    { key: "revenue",                 header: "Revenue",    w: 68 },
    { key: "cost",                    header: "Cost",       w: 68 },
    { key: "profit",                  header: "Profit",     w: 68 },
    { key: "shipmentStatus",          header: "Status",     w: 52 },
    { key: "customerPaymentStatus",   header: "Payment",    w: 46 },
  ];

  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = TABLE_W / totalW;
  const scaledCols = cols.map((c) => ({ ...c, w: Math.round(c.w * scale) }));
  scaledCols[scaledCols.length - 1].w += TABLE_W - scaledCols.reduce((s, c) => s + c.w, 0);

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], layout: "landscape", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const ready = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Page header
  doc.fillColor(DARK).fontSize(16).font("Helvetica-Bold").text("BZA International Services", MARGIN, 28);
  doc.fillColor(BLUE).fontSize(12).font("Helvetica-Bold").text(title, MARGIN, 48);
  doc.fillColor(GRAY).fontSize(8).font("Helvetica").text(`Generated: ${dateStr}  ·  ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`, MARGIN, 64);
  doc.moveTo(MARGIN, 76).lineTo(PAGE_W - MARGIN, 76).strokeColor(BLUE).lineWidth(1.5).stroke();

  let y = 88;

  function drawTableHeader() {
    doc.rect(MARGIN, y, TABLE_W, 16).fillColor(DARK).fill();
    let x = MARGIN + 3;
    scaledCols.forEach((c) => {
      doc.fillColor(WHITE).fontSize(6).font("Helvetica-Bold").text(c.header, x, y + 5, { width: c.w - 3, lineBreak: false });
      x += c.w;
    });
    y += 16;
  }

  drawTableHeader();

  let totRev = 0, totCost = 0, totProfit = 0, totTons = 0;

  rows.forEach((r, ri) => {
    if (y > MAX_Y) {
      doc.addPage();
      y = MARGIN;
      drawTableHeader();
    }
    if (ri % 2 === 0) doc.rect(MARGIN, y, TABLE_W, 14).fillColor(LIGHT).fill();

    const days = daysOverdue(r.dueDate);
    const fmt$ = (n: number) =>
      "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const vals: Record<string, string> = {
      invoiceNumber:          r.invoiceNumber,
      clientName:             r.clientName,
      product:                r.product ?? "—",
      destination:            r.destination ?? "—",
      invoiceDate:            fmtDate(r.invoiceDate),
      dueDate:                fmtDate(r.dueDate),
      days:                   days <= 0 ? "—" : `${days}d`,
      quantityTons:           r.quantityTons.toFixed(1),
      revenue:                fmt$(r.revenue),
      cost:                   fmt$(r.cost),
      profit:                 fmt$(r.profit),
      shipmentStatus:         SHIP_LABELS[r.shipmentStatus] ?? r.shipmentStatus,
      customerPaymentStatus:  r.customerPaymentStatus === "paid" ? "Paid" : "Unpaid",
    };

    let x = MARGIN + 3;
    scaledCols.forEach((c) => {
      doc.fillColor("#222").fontSize(6).font("Helvetica")
        .text(vals[c.key], x, y + 4, { width: c.w - 3, lineBreak: false, ellipsis: true });
      x += c.w;
    });

    totTons += r.quantityTons;
    totRev += r.revenue;
    totCost += r.cost;
    totProfit += r.profit;
    y += 14;
  });

  // Totals row
  if (y > MAX_Y) { doc.addPage(); y = MARGIN; }
  doc.rect(MARGIN, y, TABLE_W, 16).fillColor("#dce8ff").fill();
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(BLUE).lineWidth(0.5).stroke();
  let x = MARGIN + 3;
  const fmt$ = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  scaledCols.forEach((c) => {
    const v =
      c.key === "invoiceNumber" ? "TOTAL" :
      c.key === "quantityTons"  ? totTons.toFixed(1) :
      c.key === "revenue"       ? fmt$(totRev) :
      c.key === "cost"          ? fmt$(totCost) :
      c.key === "profit"        ? fmt$(totProfit) : "";
    doc.fillColor(DARK).fontSize(6.5).font("Helvetica-Bold")
      .text(v, x, y + 5, { width: c.w - 3, lineBreak: false });
    x += c.w;
  });

  // Page footers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const fy = PAGE_H - 28;
    doc.moveTo(MARGIN, fy).lineTo(PAGE_W - MARGIN, fy).strokeColor("#ccc").lineWidth(0.5).stroke();
    doc.fillColor(GRAY).fontSize(6.5).font("Helvetica")
      .text("BZA International Services, LLC  ·  McAllen, TX  ·  Confidential", MARGIN, fy + 5, { align: "center", width: TABLE_W });
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN, fy + 14, { align: "center", width: TABLE_W });
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
  const { email, subject, message, title, rows, format } = body as {
    email: string;
    subject: string;
    message: string;
    title: string;
    rows: InvoiceRow[];
    format: "excel" | "pdf" | "both";
  };

  if (!email || !rows?.length) {
    return NextResponse.json({ error: "Missing email or rows" }, { status: 400 });
  }

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const dateStr = new Date().toISOString().split("T")[0];
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
      content: await buildPdf(title, rows),
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
