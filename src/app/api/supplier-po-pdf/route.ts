import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, clients, suppliers, clientPurchaseOrders, supplierOrders, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const BZA_DEFAULTS = {
  companyName: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  email: "ebazua@bza-is.com",
  website: "www.bza-is.com",
  primaryColor: "#0d3d3b",
  accentColor: "#4fd1c5",
};

const SUPPLIER_ADDRESSES: Record<string, string[]> = {
  "Cascade Pacific Pulp": ["30480 American Drive", "Halsey, Oregon 97348", "United States"],
  "APP China Trading": ["APP China Trading Limited", "China"],
};

async function getSettings() {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "invoice") });
  if (!row) return BZA_DEFAULTS;
  try { return { ...BZA_DEFAULTS, ...JSON.parse(row.value) }; } catch { return BZA_DEFAULTS; }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const poId = sp.get("poId");
  const soId = sp.get("soId");
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const [po, cfg] = await Promise.all([
    db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, Number(poId)) }),
    getSettings(),
  ]);
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const [client, supplier] = await Promise.all([
    db.query.clients.findFirst({ where: eq(clients.id, po.clientId) }),
    db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) }),
  ]);

  const supplierKey = Object.keys(SUPPLIER_ADDRESSES).find(k =>
    supplier?.name?.toLowerCase().includes(k.toLowerCase())
  );
  const supplierAddress = supplierKey ? SUPPLIER_ADDRESSES[supplierKey] : [];
  const clientAddress = (client?.shipAddress || client?.billAddress || "").split("\n").filter(Boolean);

  let lineItems: { description: string; qty: number; rate: number; amount: number }[];
  let poDate: string;
  let effectiveIncoterm: string;

  if (soId) {
    const so = await db.query.supplierOrders.findFirst({ where: eq(supplierOrders.id, Number(soId)) });
    if (!so) return NextResponse.json({ error: "Supplier order not found" }, { status: 404 });
    const price = so.pricePerTon ?? po.buyPrice;
    poDate = so.orderDate || po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = so.incoterm ?? po.terms ?? "";
    const parsedLines = so.lines ? JSON.parse(so.lines) as { destination: string; tons: number; notes: string }[] : null;
    if (parsedLines && parsedLines.length > 0) {
      lineItems = parsedLines.map(l => ({
        description: `${po.product}${l.destination ? ` – ${l.destination}` : ""}${l.notes ? `\n${l.notes}` : ""}`,
        qty: l.tons, rate: price, amount: l.tons * price,
      }));
    } else {
      lineItems = [{ description: po.product, qty: so.tons, rate: price, amount: so.tons * price }];
    }
  } else {
    const cpos = await db.select().from(clientPurchaseOrders)
      .where(eq(clientPurchaseOrders.purchaseOrderId, Number(poId)))
      .orderBy(clientPurchaseOrders.clientPoNumber);
    lineItems = cpos.map(cpo => ({
      description: `${po.product}${cpo.destination ? ` – ${cpo.destination}` : ""}`,
      qty: cpo.plannedTons ?? 0, rate: po.buyPrice, amount: (cpo.plannedTons ?? 0) * po.buyPrice,
    }));
    if (lineItems.length === 0) {
      lineItems = [{ description: po.product, qty: 0, rate: po.buyPrice, amount: 0 }];
    }
    poDate = po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = po.terms ?? "";
  }

  const total = lineItems.reduce((s, l) => s + l.amount, 0);

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M = 48;
  const W = 612 - M * 2;
  const TEAL  = cfg.primaryColor;
  const CYAN  = cfg.accentColor;
  const DARK  = "#1c1917";
  const GRAY  = "#6b7280";
  const LGRAY = "#f3f4f6";
  const RULE  = "#d1d5db";

  let y = M;

  // ── CYAN TOP BAR ─────────────────────────────────────────
  doc.rect(0, 0, 612, 3).fill(CYAN);

  // ── LOGO ─────────────────────────────────────────────────
  doc.fontSize(20).font("Helvetica-Bold");
  const bzaW = doc.widthOfString("BZA");
  doc.fillColor(TEAL).text("BZA", M, y, { continued: true, lineBreak: false });
  doc.fillColor(CYAN).text(".", { lineBreak: false });

  // ── COMPANY INFO (right-aligned) ──────────────────────────
  const INFO_X = 380;
  const INFO_W = 612 - M - INFO_X;
  doc.fontSize(7).font("Helvetica").fillColor(GRAY);
  doc.text(cfg.companyName,  INFO_X, y,      { width: INFO_W, align: "right" });
  doc.text(cfg.address1,     INFO_X, y + 10, { width: INFO_W, align: "right" });
  doc.text(cfg.address2,     INFO_X, y + 19, { width: INFO_W, align: "right" });
  doc.text(cfg.email,        INFO_X, y + 28, { width: INFO_W, align: "right" });
  doc.text(cfg.website,      INFO_X, y + 37, { width: INFO_W, align: "right" });

  y += 56;

  // Hairline rule
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── PO TITLE ──────────────────────────────────────────────
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEAL).text("PURCHASE ORDER", M, y, { lineBreak: false });

  // PO # badge
  const BADGE_W = 148;
  const BADGE_X = M + W - BADGE_W;
  doc.rect(BADGE_X, y - 2, BADGE_W, 32).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN).text("PO NUMBER", BADGE_X + 8, y + 3);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("white").text(po.poNumber, BADGE_X + 8, y + 13, { width: BADGE_W - 16 });

  y += 40;

  // Date + Incoterm right of title
  doc.fontSize(7).font("Helvetica").fillColor(GRAY).text("Date: ", M + W - BADGE_W, y, { continued: true, lineBreak: false });
  doc.fillColor(DARK).text(formatDate(poDate));
  if (effectiveIncoterm) {
    doc.fontSize(7).fillColor(GRAY).text("Incoterm: ", M + W - BADGE_W, y + 10, { continued: true, lineBreak: false });
    doc.fillColor(DARK).text(effectiveIncoterm);
  }

  // ── VENDOR / SHIP TO ──────────────────────────────────────
  const C1 = M, C2 = M + 270;

  doc.fontSize(6).font("Helvetica-Bold").fillColor(GRAY);
  doc.text("VENDOR",  C1, y);
  doc.text("SHIP TO", C2, y);
  y += 10;

  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  let yV = y, yS = y;

  [supplier?.name || "", ...supplierAddress].filter(Boolean).forEach(l => {
    doc.text(l, C1, yV, { width: 210, lineBreak: false }); yV += 10;
  });
  [client?.name || "", ...clientAddress].filter(Boolean).forEach(l => {
    doc.text(l, C2, yS, { width: 210, lineBreak: false }); yS += 10;
  });

  y = Math.max(yV, yS) + 16;

  // ── TABLE ─────────────────────────────────────────────────
  const TC = { desc: M + 6, qty: M + 355, rate: M + 415, amount: M + 472 };

  doc.rect(M, y, W, 17).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor("white");
  doc.text("DESCRIPTION",  TC.desc,   y + 5);
  doc.text("QTY (TN)",     TC.qty,    y + 5);
  doc.text("RATE (USD/TN)", TC.rate,  y + 5);
  doc.text("AMOUNT",       TC.amount, y + 5);
  y += 17;

  lineItems.forEach((item, i) => {
    const descLines = item.description.split("\n").length;
    const rowH = Math.max(26, descLines * 11 + 10);
    if (i % 2 === 0) doc.rect(M, y, W, rowH).fill(LGRAY);
    doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
    doc.text(item.description, TC.desc,   y + 7, { width: 340, lineGap: 1.5 });
    doc.text(item.qty.toFixed(0),   TC.qty,    y + 7);
    doc.text(item.rate.toFixed(2),  TC.rate,   y + 7);
    doc.text(fmtCurrency(item.amount), TC.amount, y + 7);
    y += rowH;
  });

  doc.moveTo(M, y).lineTo(M + W, y).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 12;

  // ── TOTAL ─────────────────────────────────────────────────
  const TOT_W = 210;
  const TOT_X = M + W - TOT_W;
  doc.rect(TOT_X, y, TOT_W, 30).fill(TEAL);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(CYAN).text("TOTAL (USD)", TOT_X + 10, y + 6);
  doc.fontSize(12).font("Helvetica-Bold").fillColor("white").text(fmtCurrency(total), TOT_X + 10, y + 15, { width: TOT_W - 20, align: "right" });
  y += 44;

  // ── FSC NOTE ──────────────────────────────────────────────
  if (po.licenseFsc || po.inputClaim) {
    doc.rect(M, y, W * 0.7, 20).fill("#f0fdf4");
    doc.fontSize(7).font("Helvetica").fillColor("#166534")
      .text("FSC-certified material required. Supplier must include valid FSC certificate on all invoices and shipping documents.", M + 8, y + 6, { width: W * 0.7 - 16 });
    y += 28;
  }

  // ── SIGNATURE LINES ───────────────────────────────────────
  y += 6;
  doc.fontSize(7).font("Helvetica").fillColor(GRAY).text("Authorized By", M, y, { lineBreak: false });
  doc.moveTo(M + 75, y + 8).lineTo(M + 270, y + 8).strokeColor(RULE).lineWidth(0.5).stroke();
  y += 18;
  doc.text("Date", M, y, { lineBreak: false });
  doc.moveTo(M + 75, y + 8).lineTo(M + 270, y + 8).strokeColor(RULE).lineWidth(0.5).stroke();

  // ── FOOTER ────────────────────────────────────────────────
  const FOOTER_Y = 746;
  doc.rect(0, FOOTER_Y, 612, 46).fill(TEAL);
  doc.fontSize(7).font("Helvetica").fillColor(CYAN)
    .text(cfg.companyName, M, FOOTER_Y + 8, { width: W, align: "center" });
  doc.fontSize(6.5).fillColor("white").opacity(0.6)
    .text(`${cfg.email}  ·  ${cfg.website}`, M, FOOTER_Y + 20, { width: W, align: "center" });
  doc.opacity(1);
  doc.fontSize(6).fillColor("white").opacity(0.4)
    .text("Page 1 of 1", M, FOOTER_Y + 32, { width: W, align: "center" });
  doc.opacity(1);

  // Suppress unused variable warning
  void bzaW;

  doc.end();
  const buffer = await new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SupplierPO_${po.poNumber}_BZA.pdf"`,
    },
  });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
