import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
    const d = new Date(invoiceDate + "T12:00:00");
    d.setDate(d.getDate() + termsDays);
    return d.toISOString().split("T")[0];
  })();

  // Product line: e.g. "Woodpulp - Softwood\nCascade FSC\nControlled Wood"
  const productName = inv.item || po.product || "Woodpulp";
  const supplierShortName = (supplier?.name || "").split(" ")[0];
  const inputClaim = supplier?.fscInputClaim || po.inputClaim || "";
  const productLine = [
    productName,
    inputClaim ? `${supplierShortName} FSC` : "",
    inputClaim,
  ].filter(Boolean).join("\n");

  // Bales display
  const balesDisplay = inv.balesCount && inv.unitsPerBale
    ? `${inv.balesCount}/${inv.unitsPerBale}`
    : inv.balesCount ? String(inv.balesCount) : "";

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M = 45;
  const W = 612 - M * 2;
  const ORANGE = "#E8622A";
  const DARK = "#1a1a1a";
  const GRAY = "#777777";
  const LIGHT = "#f5f5f4";

  // ── TOP HEADER ───────────────────────────────────────────
  let y = M;

  // Logo circle top-right
  doc.circle(612 - M - 20, M + 20, 22).fill(ORANGE);
  doc.fontSize(22).font("Helvetica-Bold").fillColor("white").text("B", 612 - M - 33, M + 9);

  // BZA info top-left
  doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK).text(BZA.name, M, y);
  y += 13;
  doc.fontSize(7.5).font("Helvetica").fillColor(GRAY);
  const headerLines = [BZA.address1, BZA.address2, BZA.phone, BZA.email, BZA.website, `TAX ID: ${BZA.taxId}`];
  headerLines.forEach(line => { doc.text(line, M, y); y += 10; });

  y = M + 90;

  // ── INVOICE TITLE ────────────────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(ORANGE).text("INVOICE", M, y);
  y += 30;

  // ── BILL TO / SHIP TO + INVOICE META ────────────────────
  const c1 = M, c2 = M + 165, c3 = M + 330, c4 = M + 430;

  // Column labels
  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
  doc.text("BILL TO", c1, y);
  doc.text("SHIP TO", c2, y);
  doc.text("SHIP DATE", c3, y);
  doc.text("INVOICE", c4, y);
  y += 10;

  const billLines = [
    client?.name || "",
    ...(client?.billAddress || "").split("\n").filter(Boolean),
    client?.rfc || "",
  ].filter(Boolean);

  const shipLines = [
    client?.name || "",
    ...(client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean),
  ].filter(Boolean);

  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  let yBill = y, yShip = y;
  billLines.forEach(l => { doc.text(l, c1, yBill, { width: 155 }); yBill += 9; });
  shipLines.forEach(l => { doc.text(l, c2, yShip, { width: 155 }); yShip += 9; });

  // Meta right block
  const metaRows: [string, string, string, string][] = [
    ["SHIP DATE", formatDate(inv.shipmentDate), "INVOICE", invoiceNumber],
    ["SHIP VIA", po.terms || "", "DATE", formatDate(invoiceDate)],
    ["TRACKING#", inv.vehicleId || "", "TERMS", `Net ${termsDays}`],
    ["", "", "DUE DATE", formatDate(dueDate)],
  ];
  let yMeta = y;
  metaRows.forEach(([l1, v1, l2, v2]) => {
    doc.fontSize(6.5).fillColor(GRAY).text(l1, c3, yMeta);
    doc.fontSize(7.5).fillColor(DARK).text(v1, c3 + 55, yMeta, { width: 75 });
    doc.fontSize(6.5).fillColor(GRAY).text(l2, c4, yMeta);
    doc.fontSize(7.5).fillColor(DARK).text(v2, c4 + 55, yMeta, { width: 612 - M - c4 - 55 });
    yMeta += 10;
  });

  y = Math.max(yBill, yShip, yMeta) + 14;

  // ── PO / BOL / DESTINATION ───────────────────────────────
  doc.fontSize(6.5).fillColor(GRAY);
  doc.text("PURCHASE ORDER", c1, y);
  doc.text("BOL #", c2, y);
  doc.text("DESTINATION", c4, y);
  y += 10;
  doc.fontSize(8).font("Helvetica").fillColor(DARK);
  doc.text(inv.salesDocument || po.clientPoNumber || po.poNumber, c1, y);
  doc.text(inv.blNumber || "", c2, y);
  doc.text(inv.destination || "", c4, y);
  y += 20;

  // ── TABLE HEADER ─────────────────────────────────────────
  doc.rect(M, y, W, 14).fill(ORANGE);
  doc.fontSize(7).font("Helvetica-Bold").fillColor("white");
  const tc = { date: M + 3, product: M + 72, bales: M + 302, admt: M + 370, price: M + 420, total: M + 488 };
  doc.text("DATE", tc.date, y + 4);
  doc.text("PRODUCT", tc.product, y + 4);
  doc.text("BALES/UNIT", tc.bales, y + 4);
  doc.text("ADMT", tc.admt, y + 4);
  doc.text("PRICE/TON", tc.price, y + 4);
  doc.text("TOTAL", tc.total, y + 4);
  y += 14;

  // ── LINE ITEM ────────────────────────────────────────────
  const rowH = 42;
  doc.rect(M, y, W, rowH).fill(LIGHT);
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  doc.text(formatDate(inv.shipmentDate || invoiceDate), tc.date, y + 6);
  doc.text(productLine, tc.product, y + 6, { width: 222, lineGap: 2 });
  doc.text(balesDisplay, tc.bales, y + 6);
  doc.text(inv.quantityTons.toFixed(3), tc.admt, y + 6);
  doc.text(price.toFixed(2), tc.price, y + 6);
  doc.text(total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), tc.total, y + 6);
  y += rowH + 2;

  // Divider
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#dddddd").lineWidth(0.5).stroke();
  y += 14;

  // ── PAYMENT INSTRUCTIONS (left) + BALANCE DUE (right) ───
  const rightX = M + 310;

  // Balance Due box
  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY).text("BALANCE DUE", rightX, y);
  doc.fontSize(14).font("Helvetica-Bold").fillColor(DARK)
    .text(`USD ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rightX, y + 12);

  doc.fontSize(7).font("Helvetica-Bold").fillColor(GRAY).text("PAYMENT INSTRUCTIONS", M, y);
  y += 11;
  doc.font("Helvetica").fillColor(DARK).fontSize(7);
  const payLines = [
    `Bank Name: ${BZA.bank.name}`,
    `Bank Address: ${BZA.bank.address}`,
    `Beneficiary: ${BZA.bank.beneficiary}`,
    `Account: ${BZA.bank.account}`,
    `Routing: ${BZA.bank.routing}`,
    `SWIFT Code: ${BZA.bank.swift}`,
  ];
  payLines.forEach(l => { doc.text(l, M, y); y += 10; });

  y += 10;

  // ── FSC CERTIFICATE INFO ─────────────────────────────────
  doc.fontSize(7).font("Helvetica-Bold").fillColor(GRAY).text("Certificate Information FSC:", M, y);
  y += 10;
  doc.font("Helvetica").fillColor(DARK);
  doc.text(`Certificate Code: ${BZA.fsc.code}`, M, y); y += 10;
  doc.text(`Controlled Wood Certification: ${BZA.fsc.cw}`, M, y); y += 10;
  doc.text(`Expiration Date: ${BZA.fsc.expiration}`, M, y);

  // ── FOOTER ───────────────────────────────────────────────
  doc.fontSize(7).fillColor(GRAY)
    .text("All invoice amounts are stated in USD.", M, 755)
    .text("Page 1 of 1", M, 765);

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Invoice_${invoiceNumber}_BZA.pdf"`,
    },
  });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
