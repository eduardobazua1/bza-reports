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

  // Safe columns only - NO prices, costs, payments, supplier info
  const data = rows.map(r => ({
    "Invoice": r.billingDocument || r.invoiceNumber,
    "PO": r.salesDocument || r.clientPoNumber || "",
    "Product": r.item || r.product || "",
    "Quantity (TN)": r.quantityTons,
    "Ship Date": r.shipmentDate || "",
    "ETA": r.estimatedArrival || "",
    "Status": statusLabels[r.shipmentStatus] || r.shipmentStatus,
    "Location": r.currentLocation || "",
    "Vehicle": r.vehicleId || "",
    "BL Number": r.blNumber || "",
    "Transport": transportLabels[r.transportType || ""] || r.transportType || "",
  }));

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

  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const TEAL = "#0d9488";
  const DARK = "#1c1917";
  const GRAY = "#78716c";
  const LIGHT_BG = "#f5f5f4";

  // Header
  doc.fontSize(16).fillColor(DARK).text("BZA International Services, LLC", 40, 40);
  doc.fontSize(10).fillColor(GRAY).text(`Shipment Report — ${clientName}`, 40, 60);
  doc.fontSize(8).fillColor(GRAY).text(`Generated ${dateStr}`, 40, 74);
  doc.moveTo(40, 90).lineTo(732, 90).strokeColor(TEAL).lineWidth(2).stroke();

  if (data.length === 0) {
    doc.fontSize(12).fillColor(GRAY).text("No shipments found.", 40, 120);
    doc.end();
    const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));
    return new NextResponse(buffer, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.pdf"` },
    });
  }

  const headers = Object.keys(data[0]);
  const colWidths = [70, 70, 90, 55, 65, 65, 60, 80, 65, 60, 50]; // total ~730
  const tableTop = 105;
  const rowH = 18;
  const pageW = 732;
  let y = tableTop;

  function drawTableHeader() {
    doc.rect(40, y, pageW - 40, rowH).fill(TEAL);
    let x = 40;
    headers.forEach((h, i) => {
      doc.fontSize(7).fillColor("white").text(h, x + 3, y + 5, { width: colWidths[i] - 6, ellipsis: true });
      x += colWidths[i];
    });
    y += rowH;
  }

  drawTableHeader();

  // Total tons
  let totalTons = 0;

  data.forEach((row, idx) => {
    if (y > 560) {
      doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
      y = 40;
      drawTableHeader();
    }

    if (idx % 2 === 0) doc.rect(40, y, pageW - 40, rowH).fill(LIGHT_BG);

    let x = 40;
    headers.forEach((h, i) => {
      const val = String(row[h] ?? "");
      doc.fontSize(7).fillColor(DARK).text(val, x + 3, y + 5, { width: colWidths[i] - 6, ellipsis: true });
      x += colWidths[i];
    });

    if (typeof row["Quantity (TN)"] === "number") totalTons += row["Quantity (TN)"];
    y += rowH;
  });

  // Totals row
  doc.rect(40, y, pageW - 40, rowH).fill("#166534");
  doc.fontSize(7).fillColor("white").text("TOTAL", 43, y + 5);
  const tonsX = 40 + colWidths[0] + colWidths[1] + colWidths[2];
  doc.text(totalTons.toFixed(3) + " TN", tonsX + 3, y + 5);
  doc.text(`${data.length} shipments`, 40 + 400, y + 5);

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="BZA_Shipments_${safeName}_${dateStr}.pdf"` },
  });
}
