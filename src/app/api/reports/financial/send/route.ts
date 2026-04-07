import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import * as XLSX from "xlsx";
import { buildFinancialPdf, COL_MAP, AR_DEFAULT_COLS, type PdfRow } from "@/lib/financial-pdf";

type InvoiceRow = PdfRow & {
  costNoFreight?: number;
  freight?: number;
  supplierPaymentStatus?: string;
  transportType?: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function daysOverdueSend(dueDate: string | null): number {
  if (!dueDate) return 0;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  return Math.floor((new Date(today + "T00:00:00").getTime() - new Date(dueDate + "T00:00:00").getTime()) / 86400000);
}

function todayCST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

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
  days:          { header: "Days",       get: r => { const d = daysOverdueSend(r.dueDate); return d <= 0 ? "—" : d; } },
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

  // Map InvoiceRow → PdfRow (compatible — InvoiceRow is a superset)
  const pdfRows: PdfRow[] = rows.map(r => ({
    invoiceNumber:         r.invoiceNumber,
    clientName:            r.clientName,
    supplierName:          r.supplierName,
    poNumber:              r.poNumber,
    invoiceDate:           r.invoiceDate,
    shipmentDate:          r.shipmentDate,
    dueDate:               r.dueDate,
    quantityTons:          r.quantityTons,
    revenue:               r.revenue,
    cost:                  r.cost,
    profit:                r.profit,
    customerPaymentStatus: r.customerPaymentStatus,
    shipmentStatus:        r.shipmentStatus,
    destination:           r.destination,
    product:               r.product,
  }));

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
      content:  await buildFinancialPdf(pdfRows, title, colKeys),
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
