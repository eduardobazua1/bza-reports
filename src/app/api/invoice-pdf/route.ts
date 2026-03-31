import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// BZA constants
const BZA = {
  name: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  phone: "+15203317869",
  email: "accounting@bza-is.com",
  website: "www.bza-is.com",
  taxId: "32-0655438",
  bank: {
    name: "Vantage Bank",
    address: "1705 N. 23rd St. McAllen, TX 78501",
    beneficiary: "BZA International Services, LLC",
    account: "107945161",
    routing: "114915272",
    swift: "ITNBUS44",
  },
  fsc: {
    code: "CU-COC-892954",
    cw: "CU-CW-892954",
    expiration: "29-01-28",
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const invoiceNumber = sp.get("invoice");
  if (!invoiceNumber) return NextResponse.json({ error: "invoice param required" }, { status: 400 });

  const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, inv.purchaseOrderId) });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const client = await db.query.clients.findFirst({ where: eq(clients.id, po.clientId) });
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) });

  const price = inv.sellPriceOverride ?? po.sellPrice;
  const total = inv.quantityTons * price;
  const invoiceDate = inv.invoiceDate || inv.shipmentDate || new Date().toISOString().split("T")[0];
  const termsDays = inv.paymentTermsDays ?? client?.paymentTermsDays ?? 60;
  const dueDate = inv.dueDate || (() => {
    const d = new Date(invoiceDate); d.setDate(d.getDate() + termsDays);
    return d.toISOString().split("T")[0];
  })();

  // FSC product line: "Woodpulp - Softwood\nCascade FSC\nControlled Wood"
  const productName = inv.item || po.product || "Woodpulp";
  const supplierFsc = supplier?.fscInputClaim || po.inputClaim || "";
  const supplierName = supplier?.name?.split(" ")[0] || ""; // e.g. "Cascade"
  const productLine = [productName, supplierFsc ? `${supplierName} FSC` : "", supplierFsc || ""].filter(Boolean).join("\n");

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M = 45; // margin
  const W = 612 - M * 2; // usable width
  const ORANGE = "#E8622A";
  const DARK = "#1a1a1a";
  const GRAY = "#666666";
  const LIGHT = "#f5f5f5";

  let y = M;

  // ── Header ──────────────────────────────────────────────
  doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK).text(BZA.name, M, y);
  y += 14;
  doc.fontSize(8).font("Helvetica").fillColor(GRAY);
  [BZA.address1, BZA.address2, BZA.phone, BZA.email, BZA.website].forEach(line => {
    doc.text(line, M, y); y += 11;
  });

  // Logo placeholder (B letterform in orange circle) — top right
  doc.circle(612 - M - 20, M + 20, 22).fill(ORANGE);
  doc.fontSize(22).font("Helvetica-Bold").fillColor("white").text("B", 612 - M - 33, M + 9);

  y = M + 80;

  // ── "INVOICE" title ─────────────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(ORANGE).text("INVOICE", M, y);
  y += 32;

  // ── Bill To / Ship To / Invoice Details ─────────────────
  const col1 = M;
  const col2 = M + 160;
  const col3 = M + 320;
  const col4 = M + 420;

  const billLines = [
    "BILL TO", client?.name || "", client?.billAddress || "",
  ].filter(Boolean);
  const shipLines = [
    "SHIP TO", client?.name || "", client?.shipAddress || client?.billAddress || "",
  ].filter(Boolean);

  // Labels row
  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
  doc.text("BILL TO", col1, y);
  doc.text("SHIP TO", col2, y);
  doc.text("SHIP DATE", col3, y);
  doc.text("INVOICE", col4, y);
  y += 10;

  // Bill To content
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  const clientName = client?.name || "";
  const billAddr = (client?.billAddress || "").split("\n");
  const shipAddr = (client?.shipAddress || client?.billAddress || "").split("\n");

  let byLeft = y;
  [clientName, ...billAddr].forEach(line => {
    doc.text(line, col1, byLeft, { width: 150 }); byLeft += 9;
  });
  if (client?.rfc) { doc.text(client.rfc, col1, byLeft); byLeft += 9; }

  let byRight = y;
  [clientName, ...shipAddr].forEach(line => {
    doc.text(line, col2, byRight, { width: 150 }); byRight += 9;
  });

  // Right side: invoice meta
  const metaRight = 612 - M;
  const metaLabelX = col3;
  const metaValueX = col4;
  const shipDate = inv.shipmentDate ? formatDate(inv.shipmentDate) : "";
  const terms = po.terms || `Net ${termsDays}`;

  const metaRows = [
    ["SHIP DATE", shipDate, ""],
    ["SHIP VIA", terms, ""],
    ["TRACKING#", inv.vehicleId || "", ""],
  ];

  let metaY = y;
  metaRows.forEach(([label, val]) => {
    doc.fontSize(6.5).fillColor(GRAY).text(label, metaLabelX, metaY);
    doc.fontSize(7.5).fillColor(DARK).text(val, metaValueX, metaY, { width: metaRight - metaValueX });
    metaY += 10;
  });

  const invoiceMeta = [
    ["INVOICE", invoiceNumber],
    ["DATE", formatDate(invoiceDate)],
    ["TERMS", `Net ${termsDays}`],
    ["DUE DATE", formatDate(dueDate)],
  ];
  metaY = y;
  const labelX2 = col3 + 80;
  const valX2 = col4 + 60;
  invoiceMeta.forEach(([label, val]) => {
    doc.fontSize(6.5).fillColor(GRAY).text(label, labelX2, metaY);
    doc.fontSize(7.5).fillColor(DARK).text(val, valX2, metaY, { width: metaRight - valX2 });
    metaY += 10;
  });

  y = Math.max(byLeft, byRight, metaY) + 14;

  // ── PO / BOL / Destination row ───────────────────────────
  doc.fontSize(6.5).fillColor(GRAY);
  doc.text("PURCHASE ORDER", col1, y);
  doc.text("BOL #", col2, y);
  doc.text("", col3, y);
  doc.text("DESTINATION", col4, y);
  y += 10;
  doc.fontSize(8).font("Helvetica").fillColor(DARK);
  doc.text(inv.salesDocument || po.clientPoNumber || po.poNumber, col1, y);
  doc.text(inv.blNumber || "", col2, y);
  doc.text(inv.currentLocation || "", col4, y);
  y += 20;

  // ── Table header ─────────────────────────────────────────
  doc.rect(M, y, W, 14).fill(ORANGE);
  doc.fontSize(7).font("Helvetica-Bold").fillColor("white");
  const cols = { date: M + 2, product: M + 70, bales: M + 300, admt: M + 370, price: M + 420, total: M + 490 };
  doc.text("DATE", cols.date, y + 4);
  doc.text("PRODUCT", cols.product, y + 4);
  doc.text("BALES/UNIT", cols.bales, y + 4);
  doc.text("ADMT", cols.admt, y + 4);
  doc.text("PRICE/TON", cols.price, y + 4);
  doc.text("TOTAL", cols.total, y + 4);
  y += 14;

  // ── Line item ────────────────────────────────────────────
  doc.rect(M, y, W, 40).fill(LIGHT);
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(inv.shipmentDate || invoiceDate), cols.date, y + 6);
  doc.text(productLine, cols.product, y + 6, { width: 220, lineGap: 1.5 });
  doc.text(inv.balesUnit || "", cols.bales, y + 6);
  doc.text(inv.quantityTons.toFixed(3), cols.admt, y + 6);
  doc.text(price.toFixed(2), cols.price, y + 6);
  doc.text(total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), cols.total, y + 6);
  y += 44;

  // divider
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#dddddd").lineWidth(0.5).stroke();
  y += 16;

  // ── Payment Instructions + Balance Due ───────────────────
  const rightColX = M + 320;

  doc.fontSize(7).font("Helvetica-Bold").fillColor(GRAY).text("PAYMENT INSTRUCTIONS", M, y);
  y += 11;
  doc.fontSize(7).font("Helvetica").fillColor(DARK);
  const payLines = [
    `Bank Name: ${BZA.bank.name}`,
    `Bank Address: ${BZA.bank.address}`,
    `Beneficiary: ${BZA.bank.beneficiary}`,
    `Account: ${BZA.bank.account}`,
    `Routing: ${BZA.bank.routing}`,
    `SWIFT Code: ${BZA.bank.swift}`,
  ];
  payLines.forEach(line => { doc.text(line, M, y); y += 10; });

  // Balance Due — right side
  const balY = y - payLines.length * 10 - 11;
  doc.fontSize(7).fillColor(GRAY).text("BALANCE DUE", rightColX, balY + 2);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(DARK)
    .text(`USD ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightColX, balY + 14);

  y += 14;

  // FSC certificate info
  doc.fontSize(7).font("Helvetica-Bold").fillColor(GRAY).text("Certificate Information FSC:", M, y);
  y += 10;
  doc.font("Helvetica").fillColor(DARK);
  doc.text(`Certificate Code: ${BZA.fsc.code}`, M, y); y += 10;
  doc.text(`Controlled Wood Certification: ${BZA.fsc.cw}`, M, y); y += 10;
  doc.text(`Expiration Date: ${BZA.fsc.expiration}`, M, y); y += 14;
  doc.text(`TAX ID: ${BZA.taxId}`, M, y);

  // Footer
  doc.fontSize(7).fillColor(GRAY).text("All invoice amounts are stated in USD.", M, 760);
  doc.text("Page 1 of 1", M, 770);

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice_${invoiceNumber}_BZA.pdf"`,
    },
  });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
