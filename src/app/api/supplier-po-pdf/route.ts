import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, clients, suppliers, clientPurchaseOrders, supplierOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

const BZA = {
  name: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  email: "ebazua@bza-is.com",
  website: "www.bza-is.com",
};

// Hardcoded supplier addresses (add to DB later)
const SUPPLIER_ADDRESSES: Record<string, string[]> = {
  "Cascade Pacific Pulp": [
    "30480 American Drive",
    "Halsey, Oregon 97348",
    "United States",
  ],
  "APP China Trading": [
    "APP China Trading Limited",
    "China",
  ],
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const poId = sp.get("poId");
  const soId = sp.get("soId"); // optional: specific supplier order
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, Number(poId)) });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const client = await db.query.clients.findFirst({ where: eq(clients.id, po.clientId) });
  const supplier = await db.query.suppliers.findFirst({ where: eq(suppliers.id, po.supplierId) });

  // Resolve supplier address
  const supplierKey = Object.keys(SUPPLIER_ADDRESSES).find(k =>
    supplier?.name?.toLowerCase().includes(k.toLowerCase())
  );
  const supplierAddress = supplierKey ? SUPPLIER_ADDRESSES[supplierKey] : [];

  // Client ship-to address lines
  const clientAddress = (client?.shipAddress || client?.billAddress || "")
    .split("\n").filter(Boolean);

  let lineItems: { description: string; qty: number; rate: number; amount: number }[];
  let poDate: string;
  let effectiveIncoterm: string;

  if (soId) {
    // Single supplier order mode
    const so = await db.query.supplierOrders.findFirst({ where: eq(supplierOrders.id, Number(soId)) });
    if (!so) return NextResponse.json({ error: "Supplier order not found" }, { status: 404 });
    const price = so.pricePerTon ?? po.buyPrice;
    poDate = so.orderDate || po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = so.incoterm ?? po.terms ?? "";

    // If the order has line items, generate one row per line
    const parsedLines = so.lines ? JSON.parse(so.lines) as { destination: string; tons: number; notes: string }[] : null;
    if (parsedLines && parsedLines.length > 0) {
      lineItems = parsedLines.map(l => {
        const qty = l.tons;
        return {
          description: `${po.product}${l.destination ? ` – ${l.destination}` : ""}${l.notes ? `\n${l.notes}` : ""}`,
          qty,
          rate: price,
          amount: qty * price,
        };
      });
    } else {
      lineItems = [{
        description: po.product,
        qty: so.tons,
        rate: price,
        amount: so.tons * price,
      }];
    }
  } else {
    // Legacy: one line per client PO
    const cpos = await db.select().from(clientPurchaseOrders)
      .where(eq(clientPurchaseOrders.purchaseOrderId, Number(poId)))
      .orderBy(clientPurchaseOrders.clientPoNumber);
    lineItems = cpos.map(cpo => ({
      description: `${po.product}${cpo.destination ? ` – ${cpo.destination}` : ""}`,
      qty: cpo.plannedTons ?? 0,
      rate: po.buyPrice,
      amount: (cpo.plannedTons ?? 0) * po.buyPrice,
    }));
    poDate = po.poDate || new Date().toISOString().split("T")[0];
    effectiveIncoterm = po.terms ?? "";
  }

  const total = lineItems.reduce((s, l) => s + l.amount, 0);

  const doc = new PDFDocument({ size: "LETTER", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const M = 45;
  const W = 612 - M * 2;
  const BLUE = "#2563EB";
  const DARK = "#1a1a1a";
  const GRAY = "#777777";
  const LIGHT = "#f5f5f4";

  let y = M;

  // ── HEADER ────────────────────────────────────────────────
  // BZA name top-left
  doc.fontSize(11).font("Helvetica-Bold").fillColor(DARK).text(BZA.name, M, y);
  y += 13;
  doc.fontSize(7.5).font("Helvetica").fillColor(GRAY);
  [BZA.address1, BZA.address2, BZA.email, BZA.website].forEach(line => {
    doc.text(line, M, y); y += 10;
  });

  // ── TITLE ─────────────────────────────────────────────────
  y = M + 70;
  doc.fontSize(22).font("Helvetica-Bold").fillColor(BLUE).text("Purchase Order", M, y);
  y += 30;

  // ── VENDOR / SHIP TO / META ───────────────────────────────
  const c1 = M, c2 = M + 165, c3 = M + 330, c4 = M + 450;

  doc.fontSize(6.5).font("Helvetica").fillColor(GRAY);
  doc.text("VENDOR", c1, y);
  doc.text("SHIP TO", c2, y);
  doc.text("SHIP VIA", c3, y);
  doc.text("P.O.", c4, y);
  y += 10;

  // Vendor column
  doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
  let yV = y;
  [supplier?.name || "", ...supplierAddress].filter(Boolean).forEach(l => {
    doc.text(l, c1, yV, { width: 155 }); yV += 9;
  });

  // Ship To column
  let yS = y;
  [client?.name || "", ...clientAddress].filter(Boolean).forEach(l => {
    doc.text(l, c2, yS, { width: 155 }); yS += 9;
  });

  // Meta: Ship Via + PO + Date
  doc.fontSize(7.5).fillColor(DARK);
  doc.text(effectiveIncoterm, c3, y, { width: 110 });
  doc.text(po.poNumber, c4, y);
  y += 11;
  doc.fontSize(6.5).fillColor(GRAY).text("DATE", c4, y);
  y += 10;
  doc.fontSize(7.5).fillColor(DARK).text(formatDate(poDate), c4, y);

  y = Math.max(yV, yS) + 20;

  // ── TABLE HEADER ─────────────────────────────────────────
  doc.rect(M, y, W, 14).fill(BLUE);
  doc.fontSize(7).font("Helvetica-Bold").fillColor("white");
  const tc = { desc: M + 5, qty: M + 370, rate: M + 420, amount: M + 480 };
  doc.text("DESCRIPTION", tc.desc, y + 4);
  doc.text("QTY", tc.qty, y + 4);
  doc.text("RATE", tc.rate, y + 4);
  doc.text("AMOUNT", tc.amount, y + 4);
  y += 14;

  // ── LINE ITEMS ────────────────────────────────────────────
  lineItems.forEach((item, i) => {
    const rowH = 26;
    if (i % 2 === 0) doc.rect(M, y, W, rowH).fill(LIGHT);
    doc.fontSize(7.5).font("Helvetica").fillColor(DARK);
    doc.text(item.description, tc.desc, y + 7, { width: 355 });
    doc.text(item.qty.toFixed(0), tc.qty, y + 7);
    doc.text(item.rate.toFixed(2), tc.rate, y + 7);
    doc.text(fmtCurrency(item.amount), tc.amount, y + 7);
    y += rowH;
  });

  // ── DIVIDER ───────────────────────────────────────────────
  doc.moveTo(M, y).lineTo(M + W, y).strokeColor("#dddddd").lineWidth(0.5).stroke();
  y += 12;

  // ── FSC NOTE ─────────────────────────────────────────────
  if (po.licenseFsc || po.inputClaim) {
    doc.fontSize(7).font("Helvetica").fillColor(GRAY)
      .text("FSC-certified material required. Supplier must include valid FSC certificate code on all invoices and shipping docs.", M, y, { width: W * 0.6 });
  }

  // ── TOTAL ─────────────────────────────────────────────────
  doc.fontSize(8).font("Helvetica-Bold").fillColor(GRAY).text("TOTAL", tc.rate, y);
  doc.fontSize(10).fillColor(DARK).text(`USD ${fmtCurrency(total)}`, tc.amount - 10, y, { width: 120, align: "right" });

  y += 40;

  // ── SIGNATURE LINES ───────────────────────────────────────
  doc.fontSize(7).font("Helvetica").fillColor(GRAY);
  doc.text("Approved By", M, y);
  doc.moveTo(M + 65, y + 8).lineTo(M + 280, y + 8).strokeColor("#aaaaaa").lineWidth(0.5).stroke();
  y += 20;
  doc.text("Date", M, y);
  doc.moveTo(M + 65, y + 8).lineTo(M + 280, y + 8).strokeColor("#aaaaaa").lineWidth(0.5).stroke();

  // ── FOOTER ───────────────────────────────────────────────
  doc.fontSize(7).fillColor(GRAY).text("Page 1 of 1", M, 760);

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
