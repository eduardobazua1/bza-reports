import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email not configured. Add SMTP_USER and SMTP_PASS in .env.local" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { clientId, email, subject, message, columns, format, filter } = body as {
    clientId: number;
    email: string;
    subject: string;
    message: string;
    columns: string[];
    format: "excel" | "pdf" | "both";
    filter?: "active" | "all";
  };

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let rows = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      clientPoNumber: purchaseOrders.clientPoNumber,
      invoiceNumber: invoices.invoiceNumber,
      quantityTons: invoices.quantityTons,
      sellPrice: purchaseOrders.sellPrice,
      sellPriceOverride: invoices.sellPriceOverride,
      item: invoices.item,
      shipmentDate: invoices.shipmentDate,
      shipmentStatus: invoices.shipmentStatus,
      terms: purchaseOrders.terms,
      transportType: purchaseOrders.transportType,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      salesDocument: invoices.salesDocument,
      billingDocument: invoices.billingDocument,
      currentLocation: invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      estimatedArrival: invoices.estimatedArrival,
      licenseFsc: purchaseOrders.licenseFsc,
      chainOfCustody: purchaseOrders.chainOfCustody,
      inputClaim: purchaseOrders.inputClaim,
      outputClaim: purchaseOrders.outputClaim,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  if (filter === "active") {
    rows = rows.filter((r) => r.shipmentStatus !== "entregado");
  }

  const colMap: Record<string, { header: string; getValue: (r: typeof rows[0]) => string | number | null }> = {
    currentLocation: { header: "Current Location", getValue: (r) => r.currentLocation },
    lastLocationUpdate: { header: "Last Update", getValue: (r) => r.lastLocationUpdate },
    poNumber: { header: "Purchase Order", getValue: (r) => r.poNumber },
    clientPoNumber: { header: "Client PO", getValue: (r) => r.salesDocument || r.clientPoNumber },
    invoiceNumber: { header: "Invoice", getValue: (r) => r.invoiceNumber },
    vehicleId: { header: "Vehicle ID", getValue: (r) => r.vehicleId },
    blNumber: { header: "BL Number", getValue: (r) => r.blNumber },
    quantityTons: { header: "Qty (TN)", getValue: (r) => r.quantityTons },
    sellPrice: { header: "Price", getValue: (r) => `$${(r.sellPriceOverride ?? r.sellPrice ?? 0)}` },
    billingDocument: { header: "Billing Doc.", getValue: (r) => r.billingDocument },
    item: { header: "Item", getValue: (r) => r.item },
    shipmentDate: { header: "Ship Date", getValue: (r) => r.shipmentDate },
    shipmentStatus: { header: "Status", getValue: (r) => ({ programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered" }[r.shipmentStatus ?? ""] || r.shipmentStatus) },
    estimatedArrival: { header: "ETA", getValue: (r) => r.estimatedArrival },
    terms: { header: "Terms", getValue: (r) => r.terms },
    transportType: { header: "Transport", getValue: (r) => r.transportType === "ffcc" ? "FFCC" : r.transportType === "ship" ? "Ship" : r.transportType === "truck" ? "Truck" : r.transportType },
    licenseFsc: { header: "License #", getValue: (r) => r.licenseFsc },
    chainOfCustody: { header: "Chain of Custody", getValue: (r) => r.chainOfCustody },
    inputClaim: { header: "Input Claim", getValue: (r) => r.inputClaim },
    outputClaim: { header: "Output Claim", getValue: (r) => r.outputClaim },
  };

  const selectedCols = columns.filter((c) => colMap[c]);
  const headers = selectedCols.map((c) => colMap[c].header);
  const data = rows.map((r) => selectedCols.map((c) => colMap[c].getValue(r)));

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, "_");

  if (format === "excel" || format === "both") {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.min(Math.max(h.length, ...data.map((row) => String(row[i] ?? "").length)) + 2, 40),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${client.name.substring(0, 20)} Report`);
    attachments.push({
      filename: `BZA_Report_${safeName}_${dateStr}.xlsx`,
      content: Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  if (format === "pdf" || format === "both") {
    const pdfBuffer = await generatePdfBuffer(client.name, rows, selectedCols, colMap, filter === "active");
    attachments.push({
      filename: `BZA_Report_${safeName}_${dateStr}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const formatLabel = format === "both" ? "PDF and Excel" : format === "pdf" ? "PDF" : "Excel";

  try {
    await sendEmail({
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d3d3b;">BZA International Services</h2>
          <p>${message.replace(/\n/g, "<br>")}</p>
          <p style="color: #666; font-size: 13px;">Please find the ${formatLabel} report attached.</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">
            BZA International Services, LLC<br>
            1209 S. 10th St. Suite #583, McAllen, TX 78501
          </p>
        </div>
      `,
      attachments,
    });
    return NextResponse.json({ ok: true, method: format });
  } catch (emailErr) {
    const msg = emailErr instanceof Error ? emailErr.message : "Unknown email error";
    return NextResponse.json({ error: `Failed to send email: ${msg}` }, { status: 400 });
  }
}

async function generatePdfBuffer(
  clientName: string,
  rows: Array<Record<string, unknown>>,
  selectedCols: string[],
  colMap: Record<string, { header: string; getValue: (r: never) => string | number | null }>,
  showOnlyActive: boolean
): Promise<Buffer> {
  const isLandscape = selectedCols.length > 8;
  const PAGE_W = isLandscape ? 792 : 612;
  const PAGE_H = isLandscape ? 612 : 792;
  const M = 50;
  const W = PAGE_W - M * 2;
  const FOOTER_Y = PAGE_H - 70;
  const ROW_H = 16;
  const HDR_ROW_H = 18;

  const TEAL  = rgb(0.051, 0.239, 0.231);   // #0d3d3b
  const CYAN  = rgb(0.302, 0.851, 0.706);   // #4dd9b4
  const DARK  = rgb(0.2, 0.2, 0.2);
  const GRAY  = rgb(0.4, 0.4, 0.4);
  const LGRY  = rgb(0.973, 0.973, 0.973);   // #f8fafa
  const WHITE = rgb(1, 1, 1);

  // Scale column widths
  const baseWidths: Record<string, number> = {
    currentLocation: 75, lastLocationUpdate: 65, poNumber: 50, clientPoNumber: 55,
    invoiceNumber: 60, vehicleId: 65, blNumber: 55, quantityTons: 50, sellPrice: 45,
    billingDocument: 55, item: 70, shipmentDate: 60, shipmentStatus: 55, estimatedArrival: 60,
    terms: 70, transportType: 55, licenseFsc: 60, chainOfCustody: 55, inputClaim: 60, outputClaim: 60,
  };
  const totalBase = selectedCols.reduce((s, c) => s + (baseWidths[c] || 50), 0);
  const scale = W / totalBase;
  const colWidths = selectedCols.map((c) => Math.max(Math.round((baseWidths[c] || 50) * scale), 25));
  colWidths[colWidths.length - 1] += W - colWidths.reduce((s, w) => s + w, 0);

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const font  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const CAP = 0.716;

  const BY = (pkY: number) => PAGE_H - pkY;
  const RY = (pkY: number, h: number) => PAGE_H - pkY - h;

  function dt(text: string, x: number, pkY: number, size: number, f: typeof font, color: typeof DARK) {
    page.drawText(text, { x, y: BY(pkY) - size * CAP, size, font: f, color });
  }
  function dr(x: number, pkY: number, w: number, h: number, color: typeof TEAL) {
    page.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
  }
  function trunc(text: string, maxW: number, f: typeof font, size: number): string {
    if (f.widthOfTextAtSize(text, size) <= maxW) return text;
    let t = text;
    while (t.length > 0 && f.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
    return t.length > 0 ? t + "..." : text.slice(0, 1);
  }

  function drawTableHeader(ty: number): number {
    dr(M, ty, W, HDR_ROW_H, TEAL);
    let cx = M + 5;
    for (let i = 0; i < selectedCols.length; i++) {
      dt(trunc(colMap[selectedCols[i]].header, colWidths[i] - 5, fontB, 6.5), cx, ty + 5, 6.5, fontB, WHITE);
      cx += colWidths[i];
    }
    return ty + HDR_ROW_H;
  }

  function drawFooter() {
    page.drawLine({ start: { x: M, y: BY(FOOTER_Y) }, end: { x: PAGE_W - M, y: BY(FOOTER_Y) }, thickness: 1, color: CYAN });
    dt("BZA International Services, LLC | McAllen, TX | Confidential", M, FOOTER_Y + 5, 7, font, GRAY);
  }

  // Page 1 header
  dt("BZA International Services", M, 40, 18, fontB, TEAL);
  dt("1209 S. 10th St. Suite #583, McAllen, TX 78501", M, 62, 9, font, GRAY);
  page.drawLine({ start: { x: M, y: BY(82) }, end: { x: PAGE_W - M, y: BY(82) }, thickness: 2, color: CYAN });
  dt("Shipment Report", M, 92, 14, fontB, TEAL);
  dt(`Prepared for: ${clientName}`, M, 110, 10, font, GRAY);
  dt(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, M, 124, 10, font, GRAY);
  if (showOnlyActive) dt("Filter: Active shipments only", M + 250, 124, 10, font, GRAY);

  let y = 150;
  y = drawTableHeader(y);

  for (let ri = 0; ri < rows.length; ri++) {
    if (y + ROW_H > FOOTER_Y - 5) {
      drawFooter();
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = M;
      y = drawTableHeader(y);
    }
    if (ri % 2 === 0) dr(M, y, W, ROW_H, LGRY);
    let cx = M + 5;
    for (let i = 0; i < selectedCols.length; i++) {
      const val = String(colMap[selectedCols[i]].getValue(rows[ri] as never) ?? "-");
      dt(trunc(val, colWidths[i] - 5, font, 6.5), cx, y + 4, 6.5, font, DARK);
      cx += colWidths[i];
    }
    y += ROW_H;
  }

  drawFooter();

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
