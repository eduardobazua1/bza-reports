import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

const colMap: Record<string, { header: string; getValue: (r: Record<string, unknown>) => string | number | null }> = {
  currentLocation:    { header: "Current Location",  getValue: (r) => r.currentLocation as string },
  lastLocationUpdate: { header: "Last Update",        getValue: (r) => r.lastLocationUpdate as string },
  poNumber:           { header: "Purchase Order",     getValue: (r) => r.poNumber as string },
  clientPoNumber:     { header: "Client PO",          getValue: (r) => (r.salesDocument || r.clientPoNumber) as string },
  invoiceNumber:      { header: "Invoice",            getValue: (r) => r.invoiceNumber as string },
  vehicleId:          { header: "Vehicle ID",         getValue: (r) => r.vehicleId as string },
  blNumber:           { header: "BL Number",          getValue: (r) => r.blNumber as string },
  quantityTons:       { header: "Qty (TN)",           getValue: (r) => r.quantityTons as number },
  sellPrice:          { header: "Price",              getValue: (r) => `$${r.sellPriceOverride ?? r.sellPrice ?? 0}` },
  billingDocument:    { header: "Billing Doc.",       getValue: (r) => r.billingDocument as string },
  item:               { header: "Item",               getValue: (r) => r.item as string },
  shipmentDate:       { header: "Ship Date",          getValue: (r) => r.shipmentDate as string },
  shipmentStatus:     { header: "Status",             getValue: (r) => (({ programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered" } as Record<string, string>)[(r.shipmentStatus as string) ?? ""] || (r.shipmentStatus as string)) },
  estimatedArrival:   { header: "ETA",                getValue: (r) => r.estimatedArrival as string },
  terms:              { header: "Terms",              getValue: (r) => r.terms as string },
  transportType:      { header: "Transport",          getValue: (r) => r.transportType === "ffcc" ? "FFCC" : r.transportType === "ship" ? "Ship" : r.transportType === "truck" ? "Truck" : r.transportType as string },
  licenseFsc:         { header: "License #",          getValue: (r) => r.licenseFsc as string },
  chainOfCustody:     { header: "Chain of Custody",   getValue: (r) => r.chainOfCustody as string },
  inputClaim:         { header: "Input Claim",        getValue: (r) => r.inputClaim as string },
  outputClaim:        { header: "Output Claim",       getValue: (r) => r.outputClaim as string },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  const format   = (searchParams.get("format") ?? "excel") as "excel" | "pdf";
  const filter   = (searchParams.get("filter") ?? "active") as "active" | "all";
  const colsParam = searchParams.get("columns");
  const requestedCols = colsParam ? colsParam.split(",").filter(c => colMap[c]) : Object.keys(colMap);

  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let rows = await db
    .select({
      poNumber:           purchaseOrders.poNumber,
      clientPoNumber:     purchaseOrders.clientPoNumber,
      invoiceNumber:      invoices.invoiceNumber,
      quantityTons:       invoices.quantityTons,
      sellPrice:          purchaseOrders.sellPrice,
      sellPriceOverride:  invoices.sellPriceOverride,
      item:               invoices.item,
      shipmentDate:       invoices.shipmentDate,
      shipmentStatus:     invoices.shipmentStatus,
      terms:              purchaseOrders.terms,
      transportType:      purchaseOrders.transportType,
      vehicleId:          invoices.vehicleId,
      blNumber:           invoices.blNumber,
      salesDocument:      invoices.salesDocument,
      billingDocument:    invoices.billingDocument,
      currentLocation:    invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      estimatedArrival:   invoices.estimatedArrival,
      licenseFsc:         purchaseOrders.licenseFsc,
      chainOfCustody:     purchaseOrders.chainOfCustody,
      inputClaim:         purchaseOrders.inputClaim,
      outputClaim:        purchaseOrders.outputClaim,
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

  const dateStr  = new Date().toISOString().split("T")[0];
  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, "_");

  if (format === "excel") {
    const headers = requestedCols.map(c => colMap[c].header);
    const data    = rows.map(r => requestedCols.map(c => colMap[c].getValue(r as Record<string, unknown>)));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.min(Math.max(h.length, ...data.map(row => String(row[i] ?? "").length)) + 2, 40),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${client.name.substring(0, 20)} Report`);
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BZA_Report_${safeName}_${dateStr}.xlsx"`,
      },
    });
  }

  // PDF
  const pdfBuffer = await generatePdfBuffer(client.name, rows as Record<string, unknown>[], requestedCols, filter === "active");
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BZA_Report_${safeName}_${dateStr}.pdf"`,
    },
  });
}

async function generatePdfBuffer(
  clientName: string,
  rows: Record<string, unknown>[],
  selectedCols: string[],
  showOnlyActive: boolean
): Promise<Uint8Array> {
  const isLandscape = selectedCols.length > 8;
  const PAGE_W = isLandscape ? 792 : 612;
  const PAGE_H = isLandscape ? 612 : 792;
  const M       = 50;
  const W       = PAGE_W - M * 2;
  const FOOTER_Y = PAGE_H - 70;
  const ROW_H    = 16;
  const HDR_ROW_H = 18;

  const TEAL  = rgb(0.051, 0.239, 0.231);
  const CYAN  = rgb(0.302, 0.851, 0.706);
  const DARK  = rgb(0.2, 0.2, 0.2);
  const GRAY  = rgb(0.4, 0.4, 0.4);
  const LGRY  = rgb(0.973, 0.973, 0.973);
  const WHITE = rgb(1, 1, 1);

  const baseWidths: Record<string, number> = {
    currentLocation: 75, lastLocationUpdate: 65, poNumber: 50, clientPoNumber: 55,
    invoiceNumber: 60, vehicleId: 65, blNumber: 55, quantityTons: 50, sellPrice: 45,
    billingDocument: 55, item: 70, shipmentDate: 60, shipmentStatus: 55, estimatedArrival: 60,
    terms: 70, transportType: 55, licenseFsc: 60, chainOfCustody: 55, inputClaim: 60, outputClaim: 60,
  };
  const totalBase  = selectedCols.reduce((s, c) => s + (baseWidths[c] || 50), 0);
  const scale      = W / totalBase;
  const colWidths  = selectedCols.map(c => Math.max(Math.round((baseWidths[c] || 50) * scale), 25));
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

  dt("BZA International Services", M, 40, 18, fontB, TEAL);
  dt("1209 S. 10th St. Suite #583, McAllen, TX 78501", M, 62, 9, font, GRAY);
  page.drawLine({ start: { x: M, y: BY(82) }, end: { x: PAGE_W - M, y: BY(82) }, thickness: 2, color: CYAN });
  dt("Shipment Report", M, 92, 14, fontB, TEAL);
  dt(`Prepared for: ${clientName}`, M, 110, 10, font, GRAY);
  const now = new Date();
  dt(`Date: ${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")}/${now.getFullYear()}`, M, 124, 10, font, GRAY);
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
      const val = String(colMap[selectedCols[i]].getValue(rows[ri]) ?? "-");
      dt(trunc(val, colWidths[i] - 5, font, 6.5), cx, y + 4, 6.5, font, DARK);
      cx += colWidths[i];
    }
    y += ROW_H;
  }

  drawFooter();
  return await pdfDoc.save();
}
