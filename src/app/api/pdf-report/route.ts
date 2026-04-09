import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255);
}

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

const defaultColumns = ["currentLocation", "poNumber", "clientPoNumber", "invoiceNumber", "vehicleId", "blNumber", "quantityTons", "sellPrice", "shipmentStatus", "shipmentDate"];

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
  return generatePdf({
    clientId,
    columns: columns || (reportType === "tracking" ? defaultColumns : reportType === "summary" ? ["poNumber","invoiceNumber","item","quantityTons","shipmentDate","terms","shipmentStatus"] : undefined),
    filter,
  });
}

async function generatePdf({ clientId, columns: requestedColumns, filter }: { clientId: number; columns?: string[]; filter?: "active" | "all" }) {
  const showOnlyActive = filter === "active";

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

  const filteredRows = showOnlyActive ? rows.filter((r) => r.shipmentStatus !== "entregado") : rows;

  // ── pdf-lib setup (landscape) ─────────────────────────────────
  const PAGE_W = 792, PAGE_H = 612, M = 24, W = PAGE_W - M * 2;
  const FOOTER_H = 28;
  const HEADER_H = 58;
  const ROW_H = 13;
  const TABLE_HDR_H = 14;
  const FOOTER_TOP = PAGE_H - M - 10; // rows must not go below this (top-origin)

  const TEAL  = hexToRgb("#0d3d3b");
  const CYAN  = hexToRgb("#0d9488");
  const DARK  = rgb(0.11, 0.098, 0.09);
  const GRAY  = rgb(0.47, 0.443, 0.424);
  const LGRY  = rgb(0.961, 0.961, 0.961);
  const WHITE = rgb(1, 1, 1);
  const TOTAL_BG = hexToRgb("#166534");

  // Column width scaling
  const selectedDefs = selectedColKeys.map((k) => ({ key: k, ...columnDefs[k] }));
  const totalBaseWidth = selectedDefs.reduce((s, c) => s + c.baseWidth, 0);
  const scale = W / totalBaseWidth;
  const colWidths = selectedDefs.map((c) => Math.max(Math.round(c.baseWidth * scale), 22));
  const widthSum = colWidths.reduce((s, w) => s + w, 0);
  colWidths[colWidths.length - 1] += W - widthSum;

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

  function drawPageFooter() {
    dr(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, TEAL);
    const s = "BZA International Services, LLC  \u00B7  accounting@bza-is.com  \u00B7  www.bza-is.com";
    const sw = font.widthOfTextAtSize(s, 6.5);
    dt(s, (PAGE_W - sw) / 2, PAGE_H - FOOTER_H + 18, 6.5, font, CYAN);
  }

  function drawTableHeader(ty: number): number {
    dr(M, ty, W, TABLE_HDR_H, TEAL);
    let cx = M + 2;
    for (let i = 0; i < selectedDefs.length; i++) {
      dt(trunc(selectedDefs[i].header, colWidths[i] - 4, fontB, 6), cx, ty + 5, 6, fontB, WHITE);
      cx += colWidths[i];
    }
    return ty + TABLE_HDR_H;
  }

  function drawPageHeader() {
    dr(0, 0, PAGE_W, 3, CYAN);
    dt("BZA", M, M, 14, fontB, TEAL);
    dt(".", M + fontB.widthOfTextAtSize("BZA", 14), M, 14, fontB, CYAN);
    const IX = PAGE_W - M - 200;
    const infoLines = [
      "BZA International Services, LLC",
      "1209 S. 10th St. Suite A #583, McAllen, TX 78501",
      "accounting@bza-is.com  \u00B7  www.bza-is.com",
    ];
    infoLines.forEach((l, i) => {
      const tw = font.widthOfTextAtSize(l, 6.5);
      dt(l, Math.max(IX, PAGE_W - M - tw), M + 2 + i * 9, 6.5, font, GRAY);
    });
    page.drawLine({ start: { x: M, y: BY(M + 32) }, end: { x: PAGE_W - M, y: BY(M + 32) }, thickness: 1.5, color: CYAN });
    dt(`Shipment Report \u2014 ${clientName}`, M, M + 37, 9, fontB, DARK);
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    dt(`${dateStr}  \u00B7  ${filteredRows.length} shipments`, M + 220, M + 38, 7, font, GRAY);
  }

  // ── Render ────────────────────────────────────────────────────
  drawPageHeader();
  let y = M + HEADER_H;
  y = drawTableHeader(y);

  for (let ri = 0; ri < filteredRows.length; ri++) {
    if (y + ROW_H > FOOTER_TOP - TABLE_HDR_H) {
      drawPageFooter();
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      dr(0, 0, PAGE_W, 3, CYAN);
      y = M + 8;
      y = drawTableHeader(y);
    }
    if (ri % 2 === 0) dr(M, y, W, ROW_H, LGRY);
    let cx = M + 2;
    for (let i = 0; i < selectedDefs.length; i++) {
      const val = String(selectedDefs[i].getValue(filteredRows[ri]) ?? "-");
      dt(trunc(val, colWidths[i] - 4, font, 6.5), cx, y + 3, 6.5, font, DARK);
      cx += colWidths[i];
    }
    y += ROW_H;
  }

  // Totals row
  if (filteredRows.length > 0) {
    if (y + ROW_H > FOOTER_TOP - TABLE_HDR_H) {
      drawPageFooter();
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      dr(0, 0, PAGE_W, 3, CYAN);
      y = M + 8;
    }
    dr(M, y, W, ROW_H, TOTAL_BG);
    dt("TOTAL", M + 2, y + 3, 6.5, fontB, WHITE);
    const tonsIdx = selectedColKeys.indexOf("quantityTons");
    if (tonsIdx >= 0) {
      let tx = M + 2;
      for (let i = 0; i < tonsIdx; i++) tx += colWidths[i];
      const total = filteredRows.reduce((s, r) => s + r.quantityTons, 0).toFixed(3);
      dt(`${total} TN`, tx, y + 3, 6.5, fontB, WHITE);
    }
  }

  drawPageFooter();

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BZA_Report_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf"`,
    },
  });
}
