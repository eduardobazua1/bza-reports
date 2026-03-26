import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

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

  // Query data
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

  // Apply filter
  if (filter === "active") {
    rows = rows.filter((r) => r.shipmentStatus !== "entregado");
  }

  // Column mapping
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

  // Build Excel if needed
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

  // Build PDF if needed
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

// Generate PDF buffer using same data as preview
async function generatePdfBuffer(
  clientName: string,
  rows: Array<Record<string, unknown>>,
  selectedCols: string[],
  colMap: Record<string, { header: string; getValue: (r: never) => string | number | null }>,
  showOnlyActive: boolean
): Promise<Buffer> {
  const DARK_GREEN = "#0d3d3b";
  const TEAL = "#4dd9b4";
  const LIGHT_BG = "#f8fafa";
  const GRAY = "#666666";
  const WHITE = "#ffffff";

  const isLandscape = selectedCols.length > 8;
  const pageWidth = isLandscape ? 792 : 612;
  const pageHeight = isLandscape ? 612 : 792;
  const MARGIN = 50;
  const TABLE_WIDTH = pageWidth - MARGIN * 2;
  const MAX_Y = pageHeight - 70;

  // Scale column widths
  const baseWidths: Record<string, number> = {
    currentLocation: 75, lastLocationUpdate: 65, poNumber: 50, clientPoNumber: 55,
    invoiceNumber: 60, vehicleId: 65, blNumber: 55, quantityTons: 50, sellPrice: 45,
    billingDocument: 55, item: 70, shipmentDate: 60, shipmentStatus: 55, estimatedArrival: 60,
    terms: 70, transportType: 55, licenseFsc: 60, chainOfCustody: 55, inputClaim: 60, outputClaim: 60,
  };
  const totalBase = selectedCols.reduce((s, c) => s + (baseWidths[c] || 50), 0);
  const scale = TABLE_WIDTH / totalBase;
  const colWidths = selectedCols.map((c) => Math.max(Math.round((baseWidths[c] || 50) * scale), 25));
  colWidths[colWidths.length - 1] += TABLE_WIDTH - colWidths.reduce((s, w) => s + w, 0);

  const doc = new PDFDocument({ size: "LETTER", layout: isLandscape ? "landscape" : "portrait", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const pdfReady = new Promise<Buffer>((resolve) => { doc.on("end", () => resolve(Buffer.concat(chunks))); });

  // Header
  doc.fillColor(DARK_GREEN).fontSize(18).font("Helvetica-Bold").text("BZA International Services", MARGIN, 40);
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("1209 S. 10th St. Suite #583, McAllen, TX 78501", MARGIN, 62);
  doc.moveTo(MARGIN, 82).lineTo(pageWidth - MARGIN, 82).strokeColor(TEAL).lineWidth(2).stroke();

  doc.fillColor(DARK_GREEN).fontSize(14).font("Helvetica-Bold").text("Shipment Report", MARGIN, 92);
  doc.fillColor(GRAY).fontSize(10).font("Helvetica").text(`Prepared for: ${clientName}`, MARGIN, 110);
  doc.text(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, MARGIN, 124);
  if (showOnlyActive) doc.text("Filter: Active shipments only", MARGIN + 250, 124);

  let y = 150;

  // Table header
  doc.rect(MARGIN, y, TABLE_WIDTH, 18).fillColor(DARK_GREEN).fill();
  let colX = MARGIN + 5;
  selectedCols.forEach((col, i) => {
    doc.fillColor(WHITE).fontSize(6.5).font("Helvetica-Bold").text(colMap[col].header, colX, y + 5, { width: colWidths[i] - 5 });
    colX += colWidths[i];
  });
  y += 18;

  // Rows
  for (let ri = 0; ri < rows.length; ri++) {
    if (y > MAX_Y) {
      doc.addPage();
      y = MARGIN;
      doc.rect(MARGIN, y, TABLE_WIDTH, 18).fillColor(DARK_GREEN).fill();
      colX = MARGIN + 5;
      selectedCols.forEach((col, i) => {
        doc.fillColor(WHITE).fontSize(6.5).font("Helvetica-Bold").text(colMap[col].header, colX, y + 5, { width: colWidths[i] - 5 });
        colX += colWidths[i];
      });
      y += 18;
    }
    if (ri % 2 === 0) doc.rect(MARGIN, y, TABLE_WIDTH, 16).fillColor(LIGHT_BG).fill();
    colX = MARGIN + 5;
    selectedCols.forEach((col, i) => {
      const val = String(colMap[col].getValue(rows[ri] as never) ?? "-");
      doc.fillColor("#333").fontSize(6.5).font("Helvetica").text(val, colX, y + 4, { width: colWidths[i] - 5, ellipsis: true, lineBreak: false });
      colX += colWidths[i];
    });
    y += 16;
  }

  // Footer
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(GRAY).fontSize(7).font("Helvetica");
    const footerY = pageHeight - 55;
    doc.moveTo(MARGIN, footerY).lineTo(pageWidth - MARGIN, footerY).strokeColor(TEAL).lineWidth(1).stroke();
    doc.text("BZA International Services, LLC | McAllen, TX | Confidential", MARGIN, footerY + 5, { align: "center", width: TABLE_WIDTH });
    doc.text(`Page ${i + 1} of ${pages.count}`, MARGIN, footerY + 17, { align: "center", width: TABLE_WIDTH });
  }

  doc.end();
  return pdfReady;
}
