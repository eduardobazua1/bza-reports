import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

// Use require to ensure pdfkit resolves fonts from node_modules at runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const DARK_GREEN = "#0d3d3b";
const TEAL = "#4dd9b4";
const LIGHT_BG = "#f8fafa";
const GRAY = "#666666";
const WHITE = "#ffffff";

const statusLabels: Record<string, string> = {
  programado: "Scheduled",
  en_transito: "In Transit",
  en_aduana: "Customs",
  entregado: "Delivered",
};

const transportLabels: Record<string, string> = {
  ffcc: "FFCC",
  ship: "Ship",
  truck: "Truck",
};

type Row = {
  invoiceNumber: string;
  poNumber: string | null;
  poDate: string | null;
  clientPoNumber: string | null;
  clientName: string | null;
  supplierName: string | null;
  quantityTons: number;
  unit: string;
  sellPrice: number | null;
  sellPriceOverride: number | null;
  buyPrice: number | null;
  buyPriceOverride: number | null;
  item: string | null;
  product: string | null;
  shipmentDate: string | null;
  shipmentStatus: string;
  customerPaymentStatus: string;
  supplierPaymentStatus: string;
  terms: string | null;
  transportType: string | null;
  vehicleId: string | null;
  blNumber: string | null;
  currentLocation: string | null;
  lastLocationUpdate: string | null;
  salesDocument: string | null;
  billingDocument: string | null;
  licenseFsc: string | null;
  chainOfCustody: string | null;
  inputClaim: string | null;
  outputClaim: string | null;
  invoiceDate: string | null;
  paymentTermsDays: number | null;
  dueDate: string | null;
  customerPaidDate: string | null;
  supplierInvoiceNumber: string | null;
  supplierPaidDate: string | null;
  usesFactoring: boolean | null;
  notes: string | null;
  estimatedArrival: string | null;
};

// Column definitions with base widths for proportional scaling
const columnDefs: Record<string, { header: string; baseWidth: number; align: "left" | "right"; getValue: (r: Row) => string }> = {
  currentLocation: { header: "Location", baseWidth: 75, align: "left", getValue: (r) => r.currentLocation || "-" },
  lastLocationUpdate: { header: "Last Update", baseWidth: 65, align: "left", getValue: (r) => r.lastLocationUpdate ? new Date(r.lastLocationUpdate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-" },
  poNumber: { header: "PO #", baseWidth: 50, align: "left", getValue: (r) => r.poNumber || "" },
  poDate: { header: "PO Date", baseWidth: 55, align: "left", getValue: (r) => r.poDate || "-" },
  clientPoNumber: { header: "Client PO", baseWidth: 55, align: "left", getValue: (r) => r.salesDocument || r.clientPoNumber || "-" },
  clientName: { header: "Customer", baseWidth: 70, align: "left", getValue: (r) => r.clientName || "-" },
  supplierName: { header: "Supplier", baseWidth: 70, align: "left", getValue: (r) => r.supplierName || "-" },
  invoiceNumber: { header: "Invoice", baseWidth: 60, align: "left", getValue: (r) => r.invoiceNumber },
  vehicleId: { header: "Vehicle ID", baseWidth: 65, align: "left", getValue: (r) => r.vehicleId || "-" },
  blNumber: { header: "BL #", baseWidth: 55, align: "left", getValue: (r) => r.blNumber || "-" },
  quantityTons: { header: "Qty (TN)", baseWidth: 50, align: "right", getValue: (r) => r.quantityTons.toFixed(3) },
  unit: { header: "Unit", baseWidth: 35, align: "left", getValue: (r) => r.unit || "Ton" },
  sellPrice: { header: "Price", baseWidth: 45, align: "right", getValue: (r) => `$${(r.sellPriceOverride ?? r.sellPrice ?? 0).toFixed(0)}` },
  totalInvoice: { header: "Total Invoice", baseWidth: 60, align: "right", getValue: (r) => `$${(r.quantityTons * (r.sellPriceOverride ?? r.sellPrice ?? 0)).toFixed(0)}` },
  buyPrice: { header: "Buy Price", baseWidth: 50, align: "right", getValue: (r) => `$${(r.buyPriceOverride ?? r.buyPrice ?? 0).toFixed(0)}` },
  totalCost: { header: "Total Cost", baseWidth: 55, align: "right", getValue: (r) => `$${(r.quantityTons * (r.buyPriceOverride ?? r.buyPrice ?? 0)).toFixed(0)}` },
  profit: { header: "Profit", baseWidth: 50, align: "right", getValue: (r) => {
    const rev = r.quantityTons * (r.sellPriceOverride ?? r.sellPrice ?? 0);
    const cost = r.quantityTons * (r.buyPriceOverride ?? r.buyPrice ?? 0);
    return `$${(rev - cost).toFixed(0)}`;
  }},
  billingDocument: { header: "Billing Doc", baseWidth: 55, align: "left", getValue: (r) => r.billingDocument || "-" },
  item: { header: "Product", baseWidth: 70, align: "left", getValue: (r) => r.item || r.product || "-" },
  product: { header: "Product", baseWidth: 70, align: "left", getValue: (r) => r.product || "-" },
  shipmentDate: { header: "Ship Date", baseWidth: 60, align: "left", getValue: (r) => r.shipmentDate || "-" },
  shipmentStatus: { header: "Status", baseWidth: 55, align: "left", getValue: (r) => statusLabels[r.shipmentStatus] || r.shipmentStatus },
  terms: { header: "Terms", baseWidth: 70, align: "left", getValue: (r) => r.terms || "-" },
  transportType: { header: "Transport", baseWidth: 55, align: "left", getValue: (r) => transportLabels[r.transportType ?? ""] || r.transportType || "-" },
  customerPaymentStatus: { header: "Payment", baseWidth: 50, align: "left", getValue: (r) => r.customerPaymentStatus === "paid" ? "Paid" : "Pending" },
  supplierPaymentStatus: { header: "Supp. Payment", baseWidth: 55, align: "left", getValue: (r) => r.supplierPaymentStatus === "paid" ? "Paid" : "Pending" },
  licenseFsc: { header: "License FSC", baseWidth: 60, align: "left", getValue: (r) => r.licenseFsc || "-" },
  chainOfCustody: { header: "CoC", baseWidth: 55, align: "left", getValue: (r) => r.chainOfCustody || "-" },
  inputClaim: { header: "Input Claim", baseWidth: 60, align: "left", getValue: (r) => r.inputClaim || "-" },
  outputClaim: { header: "Output Claim", baseWidth: 60, align: "left", getValue: (r) => r.outputClaim || "-" },
  invoiceDate: { header: "Invoice Date", baseWidth: 60, align: "left", getValue: (r) => r.invoiceDate || "-" },
  paymentTermsDays: { header: "Terms (days)", baseWidth: 50, align: "right", getValue: (r) => r.paymentTermsDays?.toString() || "-" },
  dueDate: { header: "Due Date", baseWidth: 60, align: "left", getValue: (r) => r.dueDate || "-" },
  customerPaidDate: { header: "Paid Date", baseWidth: 60, align: "left", getValue: (r) => r.customerPaidDate || "-" },
  supplierInvoiceNumber: { header: "Supp. Invoice", baseWidth: 60, align: "left", getValue: (r) => r.supplierInvoiceNumber || "-" },
  supplierPaidDate: { header: "Supp. Paid", baseWidth: 60, align: "left", getValue: (r) => r.supplierPaidDate || "-" },
  usesFactoring: { header: "Factoring", baseWidth: 45, align: "left", getValue: (r) => r.usesFactoring ? "Yes" : "No" },
  notes: { header: "Notes", baseWidth: 80, align: "left", getValue: (r) => r.notes || "-" },
  estimatedArrival: { header: "ETA", baseWidth: 60, align: "left", getValue: (r) => r.estimatedArrival || "-" },
};

// Default columns if none specified (backward compat with old reportType)
const defaultColumns = ["currentLocation", "poNumber", "clientPoNumber", "invoiceNumber", "vehicleId", "blNumber", "quantityTons", "sellPrice", "shipmentStatus", "shipmentDate"];

// GET handler for AI-generated download links
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clientId = Number(sp.get("clientId"));
  const filter = (sp.get("filter") || "active") as "active" | "all";
  const columns = sp.get("columns")?.split(",").filter(Boolean);
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  return generatePdf({ clientId, columns, filter });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientId, columns, filter, reportType } = body as {
    clientId: number;
    columns?: string[];
    filter?: "active" | "all";
    reportType?: "tracking" | "summary" | "full";
  };
  return generatePdf({ clientId, columns: columns || (reportType === "tracking" ? defaultColumns : reportType === "summary" ? ["poNumber","invoiceNumber","item","quantityTons","shipmentDate","terms","shipmentStatus"] : undefined), filter });
}

async function generatePdf({ clientId, columns: requestedColumns, filter }: { clientId: number; columns?: string[]; filter?: "active" | "all" }) {
  const showOnlyActive = filter === "active";

  // Determine columns to use
  let selectedColKeys: string[];
  if (requestedColumns && requestedColumns.length > 0) {
    selectedColKeys = requestedColumns.filter((c: string) => columnDefs[c]);
  } else {
    selectedColKeys = defaultColumns;
  }

  if (selectedColKeys.length === 0) selectedColKeys = defaultColumns;

  const client = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const clientName = client.name;

  // Get client invoices with all possible fields
  const rows: Row[] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      poNumber: purchaseOrders.poNumber,
      poDate: purchaseOrders.poDate,
      clientPoNumber: purchaseOrders.clientPoNumber,
      clientName: clients.name,
      supplierName: suppliers.name,
      quantityTons: invoices.quantityTons,
      unit: invoices.unit,
      sellPrice: purchaseOrders.sellPrice,
      sellPriceOverride: invoices.sellPriceOverride,
      buyPrice: purchaseOrders.buyPrice,
      buyPriceOverride: invoices.buyPriceOverride,
      item: invoices.item,
      product: purchaseOrders.product,
      shipmentDate: invoices.shipmentDate,
      shipmentStatus: invoices.shipmentStatus,
      customerPaymentStatus: invoices.customerPaymentStatus,
      supplierPaymentStatus: invoices.supplierPaymentStatus,
      terms: purchaseOrders.terms,
      transportType: purchaseOrders.transportType,
      vehicleId: invoices.vehicleId,
      blNumber: invoices.blNumber,
      currentLocation: invoices.currentLocation,
      lastLocationUpdate: invoices.lastLocationUpdate,
      salesDocument: invoices.salesDocument,
      billingDocument: invoices.billingDocument,
      licenseFsc: purchaseOrders.licenseFsc,
      chainOfCustody: purchaseOrders.chainOfCustody,
      inputClaim: purchaseOrders.inputClaim,
      outputClaim: purchaseOrders.outputClaim,
      invoiceDate: invoices.invoiceDate,
      paymentTermsDays: invoices.paymentTermsDays,
      dueDate: invoices.dueDate,
      customerPaidDate: invoices.customerPaidDate,
      supplierInvoiceNumber: invoices.supplierInvoiceNumber,
      supplierPaidDate: invoices.supplierPaidDate,
      usesFactoring: invoices.usesFactoring,
      notes: invoices.notes,
      estimatedArrival: invoices.estimatedArrival,
    })
    .from(invoices)
    .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.clientId, clientId))
    .orderBy(purchaseOrders.poNumber, invoices.invoiceNumber);

  // Filter rows
  const filteredRows = showOnlyActive ? rows.filter((r) => r.shipmentStatus !== "entregado") : rows;

  // Calculate KPIs
  let totalTons = 0, totalRevenue = 0;
  let deliveredCount = 0;
  const activeCount = rows.filter((r) => r.shipmentStatus !== "entregado").length;

  for (const r of rows) {
    const sell = r.sellPriceOverride ?? r.sellPrice ?? 0;
    totalTons += r.quantityTons;
    totalRevenue += r.quantityTons * sell;
    if (r.shipmentStatus === "entregado") deliveredCount++;
  }

  // Always landscape for reports — more columns fit
  const M = 24; // margin
  const pageW = 792; // landscape letter width
  const pageH = 612; // landscape letter height
  const TABLE_W = pageW - M * 2;
  const FOOTER_Y = pageH - M - 10;
  const HEADER_H = 58; // space taken by page header

  // Scale column widths proportionally
  const selectedDefs = selectedColKeys.map((k) => ({ key: k, ...columnDefs[k] }));
  const totalBaseWidth = selectedDefs.reduce((s, c) => s + c.baseWidth, 0);
  const scale = TABLE_W / totalBaseWidth;
  const colWidths = selectedDefs.map((c) => Math.max(Math.round(c.baseWidth * scale), 22));
  const widthSum = colWidths.reduce((s, w) => s + w, 0);
  colWidths[colWidths.length - 1] += TABLE_W - widthSum;

  const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 0, autoFirstPage: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const pdfReady = new Promise<Buffer>((resolve) => { doc.on("end", () => resolve(Buffer.concat(chunks))); });

  const TEAL_COLOR = "#0d9488";
  const DARK_COLOR = "#1c1917";
  const GRAY_COLOR = "#78716c";
  const ROW_BG = "#f5f5f4";
  const TOTAL_BG = "#166534";

  // ── HEADER (drawn once per page) ─────────────────────────────
  function drawPageHeader() {
    // Top cyan bar
    doc.rect(0, 0, pageW, 3).fill(TEAL_COLOR);

    // BZA. logo
    doc.fontSize(14).font("Helvetica-Bold").fillColor(DARK_GREEN).text("BZA", M, M + 2, { lineBreak: false });
    doc.fillColor(TEAL_COLOR).text(".", { lineBreak: false });

    // Right: company info
    const IX = pageW - M - 200;
    doc.fontSize(6.5).font("Helvetica").fillColor(GRAY_COLOR);
    doc.text("BZA International Services, LLC", IX, M + 2, { width: 200, align: "right", lineBreak: false });
    doc.text("1209 S. 10th St. Suite A #583, McAllen, TX 78501", IX, M + 11, { width: 200, align: "right", lineBreak: false });
    doc.text("accounting@bza-is.com  ·  www.bza-is.com", IX, M + 20, { width: 200, align: "right", lineBreak: false });

    // Teal separator line
    doc.moveTo(M, M + 32).lineTo(pageW - M, M + 32).strokeColor(TEAL_COLOR).lineWidth(1.5).stroke();

    // Report title
    doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK_COLOR)
      .text(`Shipment Report — ${clientName}`, M, M + 37, { lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor(GRAY_COLOR)
      .text(
        `${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  ·  ${filteredRows.length} shipments`,
        M + 220, M + 38, { lineBreak: false }
      );
  }

  // ── TABLE HEADER ─────────────────────────────────────────────
  function drawTableHeader(ty: number) {
    doc.rect(M, ty, TABLE_W, 14).fill(DARK_GREEN);
    let cx = M + 2;
    for (let i = 0; i < selectedDefs.length; i++) {
      doc.fontSize(6).font("Helvetica-Bold").fillColor(WHITE)
        .text(selectedDefs[i].header, cx, ty + 4, { width: colWidths[i] - 2, lineBreak: false, ellipsis: true });
      cx += colWidths[i];
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────
  function drawPageFooter() {
    doc.rect(0, pageH - 28, pageW, 28).fill(DARK_GREEN);
    doc.fontSize(6.5).font("Helvetica").fillColor(TEAL_COLOR)
      .text("BZA International Services, LLC  ·  accounting@bza-is.com  ·  www.bza-is.com",
        M, pageH - 18, { width: TABLE_W, align: "center", lineBreak: false });
  }

  const ROW_H = 13;

  // ── RENDER ────────────────────────────────────────────────────
  drawPageHeader();
  let y = M + HEADER_H;
  drawTableHeader(y);
  y += 14;

  for (let ri = 0; ri < filteredRows.length; ri++) {
    if (y + ROW_H > FOOTER_Y - 14) {
      drawPageFooter();
      doc.addPage({ size: "LETTER", layout: "landscape", margin: 0 });
      doc.rect(0, 0, pageW, 3).fill(TEAL_COLOR);
      y = M + 8;
      drawTableHeader(y);
      y += 14;
    }
    if (ri % 2 === 0) doc.rect(M, y, TABLE_W, ROW_H).fill(ROW_BG);
    let cx = M + 2;
    for (let i = 0; i < selectedDefs.length; i++) {
      const val = String(selectedDefs[i].getValue(filteredRows[ri]) ?? "-");
      doc.fontSize(6.5).font("Helvetica").fillColor(DARK_COLOR)
        .text(val, cx, y + 3, { width: colWidths[i] - 2, lineBreak: false, ellipsis: true });
      cx += colWidths[i];
    }
    y += ROW_H;
  }

  // Totals row
  if (filteredRows.length > 0) {
    if (y + ROW_H > FOOTER_Y - 14) {
      drawPageFooter();
      doc.addPage({ size: "LETTER", layout: "landscape", margin: 0 });
      doc.rect(0, 0, pageW, 3).fill(TEAL_COLOR);
      y = M + 8;
    }
    doc.rect(M, y, TABLE_W, ROW_H).fill(TOTAL_BG);
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(WHITE)
      .text("TOTAL", M + 2, y + 3, { lineBreak: false });
    const tonsIdx = selectedColKeys.indexOf("quantityTons");
    if (tonsIdx >= 0) {
      let tx = M + 2;
      for (let i = 0; i < tonsIdx; i++) tx += colWidths[i];
      doc.fontSize(6.5).font("Helvetica-Bold").fillColor(WHITE)
        .text(`${filteredRows.reduce((s, r) => s + r.quantityTons, 0).toFixed(3)} TN`, tx, y + 3, { width: colWidths[tonsIdx] - 2, lineBreak: false });
    }
  }

  drawPageFooter();
  doc.end();
  const buffer = await pdfReady;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BZA_Report_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf"`,
    },
  });
}
