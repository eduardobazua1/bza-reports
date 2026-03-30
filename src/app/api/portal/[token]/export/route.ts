import { db } from "@/db";
import { clients, invoices, purchaseOrders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

async function generatePDF(data: Record<string, any>[], clientName: string, safeName: string, dateStr: string) {
  const PDFDocument = (await import("pdfkit")).default;

  // LETTER landscape = 792 x 612 pts
  const M = 20; // margin
  const pageW = 792 - M * 2; // 752 usable
  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: M });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const TEAL = "#0d9488";
  const DARK = "#1c1917";
  const GRAY = "#78716c";
  const LIGHT_BG = "#f5f5f4";

  if (data.length === 0) {
    doc.fontSize(14).fillColor(DARK).text("BZA International Services, LLC", M, 30);
    doc.fontSize(10).fillColor(GRAY).text("No shipments found.", M, 60);
    doc.end();
    const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));
    return new NextResponse(buffer, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.pdf"` },
    });
  }

  const headers = Object.keys(data[0]);
  const numCols = headers.length;
  // Distribute page width proportionally
  // Invoice(55) PO(55) Product(85) Qty(48) Price(52) ShipDate(58) ETA(58) Status(58) Location(75) Vehicle(58) BL(55) Transport(45)
  const rawWidths = [55, 55, 85, 48, 52, 58, 58, 58, 75, 58, 55, 45];
  const rawTotal = rawWidths.reduce((a, b) => a + b, 0);
  const colWidths = rawWidths.map(w => Math.round((w / rawTotal) * pageW));
  const rowH = 15;
  let y = 0;

  function drawPageHeader() {
    doc.fontSize(12).fillColor(DARK).text("BZA International Services, LLC", M, M + 5);
    doc.fontSize(8).fillColor(GRAY).text(`Shipment Report — ${clientName}`, M, M + 20);
    doc.fontSize(7).fillColor(GRAY).text(`Generated ${dateStr} · ${data.length} shipments`, M, M + 32);
    doc.moveTo(M, M + 44).lineTo(M + pageW, M + 44).strokeColor(TEAL).lineWidth(1.5).stroke();
    y = M + 52;
  }

  function drawTableHeader() {
    doc.rect(M, y, pageW, rowH).fill(TEAL);
    let x = M;
    headers.forEach((h, i) => {
      doc.fontSize(6).fillColor("white").text(h, x + 2, y + 4, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    });
    y += rowH;
  }

  drawPageHeader();
  drawTableHeader();

  let totalTons = 0;

  data.forEach((row, idx) => {
    if (y > 570) {
      doc.addPage({ size: "LETTER", layout: "landscape", margin: M });
      y = M;
      drawTableHeader();
    }

    if (idx % 2 === 0) doc.rect(M, y, pageW, rowH).fill(LIGHT_BG);

    let x = M;
    headers.forEach((h, i) => {
      let val = row[h];
      if (typeof val === "number") {
        val = h.includes("Price") || h.includes("Total") ? "$" + val.toFixed(2) : val.toFixed(3);
      }
      doc.fontSize(6).fillColor(DARK).text(String(val ?? ""), x + 2, y + 4, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    });

    if (typeof row["Quantity (TN)"] === "number") totalTons += row["Quantity (TN)"];
    y += rowH;
  });

  // Totals row
  doc.rect(M, y, pageW, rowH).fill("#166534");
  let tx = M;
  doc.fontSize(6).fillColor("white").text("TOTAL", tx + 2, y + 4);
  tx += colWidths[0] + colWidths[1] + colWidths[2]; // skip to Qty column
  doc.text(totalTons.toFixed(3) + " TN", tx + 2, y + 4, { width: colWidths[3] + colWidths[4] - 4 });

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.pdf"` },
  });
}
