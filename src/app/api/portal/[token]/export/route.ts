import { db } from "@/db";
import { clients, invoices, purchaseOrders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const statusLabels: Record<string, string> = {
  programado: "Scheduled", en_transito: "In Transit", en_aduana: "Customs", entregado: "Delivered",
};
const transportLabels: Record<string, string> = {
  ffcc: "Rail", ship: "Ship", truck: "Truck",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") || "xlsx";
  const filter = sp.get("filter") || "all";
  const dateFrom = sp.get("dateFrom") || "";
  const dateTo = sp.get("dateTo") || "";
  const poSearch = sp.get("po") || "";
  const productSearch = sp.get("product") || "";

  // Validate token
  const client = await db.query.clients.findFirst({
    where: eq(clients.accessToken, token),
  });
  if (!client || !client.portalEnabled) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Query all shipments (no limit for export)
  let rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      billingDocument: invoices.billingDocument,
      salesDocument: invoices.salesDocument,
      clientPoNumber: purchaseOrders.clientPoNumber,
      item: invoices.item,
      product: purchaseOrders.product,
      quantityTons: invoices.quantityTons,
      sellPrice: purchaseOrders.sellPrice,
      sellPriceOverride: invoices.sellPriceOverride,
      shipmentDate: invoices.shipmentDate,
      estimatedArrival: invoices.estimatedArrival,
      shipmentStatus: invoices.shipmentStatus,
      currentLocation: invoices.currentLocation,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      transportType: purchaseOrders.transportType,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.clientId, client.id))
    .orderBy(desc(invoices.shipmentDate));

  // Apply filters
  if (filter === "active") rows = rows.filter(r => r.shipmentStatus !== "entregado");
  if (filter === "delivered") rows = rows.filter(r => r.shipmentStatus === "entregado");
  if (dateFrom) rows = rows.filter(r => r.shipmentDate && r.shipmentDate >= dateFrom);
  if (dateTo) rows = rows.filter(r => r.shipmentDate && r.shipmentDate <= dateTo);
  if (poSearch) rows = rows.filter(r => (r.salesDocument || r.clientPoNumber || "").toLowerCase().includes(poSearch.toLowerCase()));
  if (productSearch) rows = rows.filter(r => (r.item || r.product || "").toLowerCase().includes(productSearch.toLowerCase()));

  // Client-safe columns: includes sell price (their purchase price), NO buy price/cost/supplier
  const data = rows.map(r => {
    const price = r.sellPriceOverride ?? r.sellPrice ?? 0;
    const total = r.quantityTons * price;
    return {
      "Invoice": r.billingDocument || r.invoiceNumber,
      "PO": r.salesDocument || r.clientPoNumber || "",
      "Product": r.item || r.product || "",
      "Quantity (TN)": r.quantityTons,
      "Price (USD/TN)": price,
      "Ship Date": r.shipmentDate || "",
      "ETA": r.estimatedArrival || "",
      "Status": statusLabels[r.shipmentStatus] || r.shipmentStatus,
      "Location": r.currentLocation || "",
      "Vehicle": r.vehicleId || "",
      "BL Number": r.blNumber || "",
      "Transport": transportLabels[r.transportType || ""] || r.transportType || "",
    };
  });

  const safeName = client.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  const dateStr = new Date().toISOString().split("T")[0];

  if (format === "pdf") {
    return generatePDF(data, client.name, safeName, dateStr);
  }
  return generateExcel(data, safeName, dateStr);
}

function generateExcel(data: Record<string, any>[], safeName: string, dateStr: string) {
  if (data.length === 0) {
    data = [{ "Invoice": "No data", "PO": "", "Product": "", "Quantity (TN)": 0, "Ship Date": "", "ETA": "", "Status": "", "Location": "", "Vehicle": "", "BL Number": "", "Transport": "" }];
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => r[h]));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(row => String(row[i] ?? "").length));
    return { wch: Math.min(maxLen + 2, 40) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Shipments");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.xlsx"`,
    },
  });
}

async function generatePDF(data: Record<string, unknown>[], clientName: string, safeName: string, dateStr: string) {
  const PAGE_W = 792, PAGE_H = 612, M = 20;
  const W = PAGE_W - M * 2; // 752 usable
  const ROW_H = 15;
  const HDR_H = 15;
  const SAFE_BOTTOM = PAGE_H - 30; // stop before this y (top-origin)

  const TEAL    = rgb(0.051, 0.584, 0.533);  // #0d9488
  const DARK    = rgb(0.11, 0.098, 0.09);
  const GRAY    = rgb(0.47, 0.443, 0.424);
  const LGRY    = rgb(0.961, 0.961, 0.961);  // #f5f5f4
  const WHITE   = rgb(1, 1, 1);
  const TOTBG   = rgb(0.086, 0.396, 0.204);  // #166534

  // Fixed column widths proportional to raw widths
  const rawWidths = [55, 55, 85, 48, 52, 58, 58, 58, 75, 58, 55, 45];
  const rawTotal = rawWidths.reduce((a, b) => a + b, 0);
  const colWidths = rawWidths.map(w => Math.round((w / rawTotal) * W));
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

  const headers = data.length > 0 ? Object.keys(data[0]) : ["Invoice","PO","Product","Quantity (TN)","Price (USD/TN)","Ship Date","ETA","Status","Location","Vehicle","BL Number","Transport"];

  function drawTableHeader(ty: number): number {
    dr(M, ty, W, HDR_H, TEAL);
    let x = M;
    headers.forEach((h, i) => {
      dt(trunc(h, colWidths[i] - 4, fontB, 6), x + 2, ty + 4, 6, fontB, WHITE);
      x += colWidths[i];
    });
    return ty + HDR_H;
  }

  // Page 1 header
  dt("BZA International Services, LLC", M, M + 5, 12, fontB, DARK);
  dt(`Shipment Report \u2014 ${clientName}`, M, M + 20, 8, font, GRAY);
  dt(`Generated ${dateStr} \u00B7 ${data.length} shipments`, M, M + 32, 7, font, GRAY);
  page.drawLine({ start: { x: M, y: BY(M + 44) }, end: { x: M + W, y: BY(M + 44) }, thickness: 1.5, color: TEAL });

  let y = M + 52;
  y = drawTableHeader(y);

  let totalTons = 0;

  for (let idx = 0; idx < data.length; idx++) {
    if (y + ROW_H > SAFE_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = M;
      y = drawTableHeader(y);
    }

    if (idx % 2 === 0) dr(M, y, W, ROW_H, LGRY);

    let x = M;
    headers.forEach((h, i) => {
      let val = data[idx][h];
      if (typeof val === "number") {
        val = h.includes("Price") || h.includes("Total") ? "$" + val.toFixed(2) : val.toFixed(3);
      }
      dt(trunc(String(val ?? ""), colWidths[i] - 4, font, 6), x + 2, y + 4, 6, font, DARK);
      x += colWidths[i];
    });

    const qty = data[idx]["Quantity (TN)"];
    if (typeof qty === "number") totalTons += qty;
    y += ROW_H;
  }

  // Totals row
  if (data.length > 0) {
    if (y + ROW_H > SAFE_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = M;
    }
    dr(M, y, W, ROW_H, TOTBG);
    dt("TOTAL", M + 2, y + 4, 6, fontB, WHITE);
    // Skip to Qty column (cols 0,1,2)
    const qtyX = M + colWidths[0] + colWidths[1] + colWidths[2];
    dt(totalTons.toFixed(3) + " TN", qtyX + 2, y + 4, 6, fontB, WHITE);
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.pdf"`,
    },
  });
}
