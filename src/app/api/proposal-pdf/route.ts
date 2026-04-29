import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { getProposal } from "@/server/queries";

export const dynamic = "force-dynamic";

// ── Page layout ────────────────────────────────────────────────────────────────
const PAGE_W   = 612;
const PAGE_H   = 792;
const MARGIN   = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;   // 516 pt

// ── BZA brand palette ──────────────────────────────────────────────────────────
const C_DARK       = rgb(0.11, 0.09, 0.09);     // stone-900
const C_GRAY       = rgb(0.40, 0.40, 0.40);
const C_HEADER_BG  = rgb(0.051, 0.239, 0.231);  // #0d3d3b
const C_TEAL       = rgb(0.051, 0.580, 0.533);  // #0d9488
const C_TEAL_LIGHT = rgb(0.310, 0.820, 0.773);  // #4fd1c5
const C_ALT_ROW    = rgb(0.97, 0.98, 0.98);
const C_TOTALS_BG  = rgb(0.88, 0.96, 0.94);
const C_RULE       = rgb(0.82, 0.82, 0.82);
const C_WHITE      = rgb(1, 1, 1);

type RGB = ReturnType<typeof rgb>;

const BY  = (y: number) => PAGE_H - y;
const RY  = (y: number, h: number) => PAGE_H - y - h;

function fillRect(p: PDFPage, x: number, y: number, w: number, h: number, c: RGB) {
  p.drawRectangle({ x, y: RY(y, h), width: w, height: h, color: c });
}
function hline(p: PDFPage, x1: number, y: number, x2: number, c: RGB, t = 0.5) {
  p.drawLine({ start: { x: x1, y: BY(y) }, end: { x: x2, y: BY(y) }, thickness: t, color: c });
}
function fitText(s: string, maxW: number, f: PDFFont, sz: number) {
  if (f.widthOfTextAtSize(s, sz) <= maxW) return s;
  while (s.length > 1 && f.widthOfTextAtSize(s + "…", sz) > maxW) s = s.slice(0, -1);
  return s + "…";
}
function drawText(
  p: PDFPage, text: string, x: number, y: number, cellW: number, rowH: number,
  opts: { font: PDFFont; size: number; color: RGB; align?: "left"|"right"|"center" },
) {
  const { font, size, color, align = "left" } = opts;
  const pad = 4;
  const inner = cellW - pad * 2;
  const s = fitText(text, inner, font, size);
  const tw = font.widthOfTextAtSize(s, size);
  const capH = size * 0.716;
  const baseY = BY(y) - rowH / 2 - capH / 2;
  let drawX = x + pad;
  if (align === "right")  drawX = x + cellW - pad - tw;
  if (align === "center") drawX = x + (cellW - tw) / 2;
  p.drawText(s, { x: drawX, y: baseY, size, font, color });
}

// ── Proposal columns ───────────────────────────────────────────────────────────
// Widths: # | Product | Description | Tons | Unit | Price/Ton | Total
const COL_WIDTHS = [22, 110, 130, 48, 36, 70, 70] as const; // sums to 486 < 516
// Adjust last to fill exactly:
const TOTAL_DEFINED = COL_WIDTHS.reduce((s, w) => s + w, 0);
const COL_W = [...COL_WIDTHS] as number[];
COL_W[COL_W.length - 1] = CONTENT_W - TOTAL_DEFINED + COL_WIDTHS[COL_WIDTHS.length - 1];

const COL_HEADERS = ["#", "Product", "Description / Notes", "Tons", "Unit", "Price / MT", "Total"];
const COL_ALIGNS  = ["center","left","left","right","center","right","right"] as const;

const ROW_H    = 22;
const HROW_H   = 16;
const FOOTER_H = 30;

function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDate(s: string) {
  const [y, m, d] = s.split("T")[0].split("-");
  if (!y || !m || !d) return s;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

// ── Main PDF builder ───────────────────────────────────────────────────────────
export async function buildProposalPdf(proposalId: number): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const data = (await getProposal(proposalId))!;
  if (!data) throw new Error(`Proposal ${proposalId} not found`);

  const pdfDoc = await PDFDocument.create();
  const boldFont    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const MAX_Y  = PAGE_H - MARGIN - FOOTER_H;

  // ── Helper: add page + header ──────────────────────────────────────────────
  function addPage(pageNum: number): [PDFPage, number] {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = MARGIN;

    if (pageNum === 1) {
      // Thin cyan bar at top
      fillRect(page, 0, 0, PAGE_W, 3, C_TEAL);

      // BZA. logo (left)
      const LSIZE = 15;
      const CAP = 0.716;
      const bzaW = boldFont.widthOfTextAtSize("BZA", LSIZE);
      page.drawText("BZA", { x: MARGIN, y: BY(y + 4) - LSIZE * CAP, size: LSIZE, font: boldFont, color: C_HEADER_BG });
      page.drawText(".", { x: MARGIN + bzaW, y: BY(y + 4) - LSIZE * CAP, size: LSIZE, font: boldFont, color: C_TEAL_LIGHT });

      // Company info (right)
      const infoLines = [
        "BZA International Services, LLC",
        "accounting@bza-is.com  ·  www.bza-is.com",
      ];
      infoLines.forEach((line, i) => {
        const lw = regularFont.widthOfTextAtSize(line, 7);
        page.drawText(line, { x: PAGE_W - MARGIN - lw, y: BY(y + 4 + i * 10) - 7 * CAP, size: 7, font: regularFont, color: C_GRAY });
      });

      y += 28;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_TEAL, 1);
      y += 10;

      // PROPOSAL title + number
      const titleStr = `PROPOSAL  ${data.proposalNumber}`;
      const titleSz  = 13;
      const titleW   = boldFont.widthOfTextAtSize(titleStr, titleSz);
      page.drawText(titleStr, { x: (PAGE_W - titleW) / 2, y: BY(y) - titleSz * CAP, size: titleSz, font: boldFont, color: C_DARK });
      y += titleSz + 5;

      if (data.title && data.title !== "Proposal") {
        const subW = regularFont.widthOfTextAtSize(data.title, 9);
        page.drawText(data.title, { x: (PAGE_W - subW) / 2, y: BY(y) - 9 * CAP, size: 9, font: regularFont, color: C_GRAY });
        y += 14;
      }

      y += 6;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 0.5);
      y += 10;

      // ── Proposal metadata (2 columns) ─────────────────────────────────────
      const LABEL_SZ = 7;
      const VAL_SZ   = 8;
      const COL1_X   = MARGIN;
      const COL2_X   = MARGIN + CONTENT_W / 2 + 10;

      function metaLine(px: number, py: number, label: string, value: string) {
        page.drawText(label, { x: px, y: BY(py) - LABEL_SZ * CAP, size: LABEL_SZ, font: regularFont, color: C_GRAY });
        page.drawText(value, { x: px + 72, y: BY(py) - VAL_SZ * CAP, size: VAL_SZ, font: boldFont, color: C_DARK });
      }

      const col1: [string, string][] = [
        ["Client:",       data.client?.name || "—"],
        ["Proposal Date:", fmtDate(data.proposalDate)],
        ["Valid Until:",  data.validUntil ? fmtDate(data.validUntil) : "—"],
      ];
      const col2: [string, string][] = [
        ["Incoterm:",     data.incoterm     || "—"],
        ["Payment Terms:", data.paymentTerms || "—"],
        ["Status:",       (data.status || "draft").charAt(0).toUpperCase() + (data.status || "draft").slice(1)],
      ];

      const META_LINE_H = 14;
      col1.forEach(([l, v], i) => metaLine(COL1_X, y + i * META_LINE_H, l, v));
      col2.forEach(([l, v], i) => metaLine(COL2_X, y + i * META_LINE_H, l, v));
      y += col1.length * META_LINE_H + 10;

      hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 0.5);
      y += 8;

    } else {
      // Continuation header
      fillRect(page, 0, 0, PAGE_W, 3, C_TEAL);
      const LSIZE = 9;
      const CAP = 0.716;
      const bzaW = boldFont.widthOfTextAtSize("BZA", LSIZE);
      page.drawText("BZA", { x: MARGIN, y: BY(y + 4) - LSIZE * CAP, size: LSIZE, font: boldFont, color: C_HEADER_BG });
      page.drawText(".", { x: MARGIN + bzaW, y: BY(y + 4) - LSIZE * CAP, size: LSIZE, font: boldFont, color: C_TEAL_LIGHT });
      const contStr = `${data.proposalNumber}  (cont.)`;
      page.drawText(contStr, { x: MARGIN + bzaW + 10 + 4, y: BY(y + 4) - 8 * CAP, size: 8, font: boldFont, color: C_DARK });
      const pgStr = `Page ${pageNum}`;
      const pgW = regularFont.widthOfTextAtSize(pgStr, 7);
      page.drawText(pgStr, { x: PAGE_W - MARGIN - pgW, y: BY(y + 4) - 7 * CAP, size: 7, font: regularFont, color: C_GRAY });
      y += 22;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_TEAL, 0.5);
      y += 8;
    }

    return [page, y];
  }

  // ── Column header row ──────────────────────────────────────────────────────
  function drawColHeaders(page: PDFPage, y: number): number {
    fillRect(page, MARGIN, y, CONTENT_W, HROW_H, C_HEADER_BG);
    let x = MARGIN;
    COL_HEADERS.forEach((h, i) => {
      drawText(page, h.toUpperCase(), x, y, COL_W[i], HROW_H, {
        font: boldFont, size: 6, color: C_WHITE, align: COL_ALIGNS[i] as "left"|"right"|"center",
      });
      x += COL_W[i];
    });
    return y + HROW_H;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  function drawFooter(page: PDFPage, pageIdx: number, totalPages: number) {
    const fy = PAGE_H - MARGIN + 4;
    hline(page, MARGIN, fy, PAGE_W - MARGIN, C_RULE, 0.5);
    const now = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    page.drawText(`Generated ${now}`, { x: MARGIN, y: BY(fy + 14) - 6 * 0.716, size: 6, font: regularFont, color: C_GRAY });
    const pgStr = `Page ${pageIdx + 1} of ${totalPages}`;
    const pgW = regularFont.widthOfTextAtSize(pgStr, 6);
    page.drawText(pgStr, { x: PAGE_W - MARGIN - pgW, y: BY(fy + 14) - 6 * 0.716, size: 6, font: regularFont, color: C_GRAY });
  }

  // ── Build pages ────────────────────────────────────────────────────────────
  let pageNum = 1;
  let [page, y] = addPage(pageNum);
  y = drawColHeaders(page, y);

  const items = data.items ?? [];
  let grandTotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Multi-line rows: wrap description if needed
    const lineTotal = item.tons * item.pricePerTon;
    grandTotal += lineTotal;

    if (y + ROW_H > MAX_Y) {
      pageNum++;
      [page, y] = addPage(pageNum);
      y = drawColHeaders(page, y);
    }

    // Alternate row shading
    if (i % 2 === 1) fillRect(page, MARGIN, y, CONTENT_W, ROW_H, C_ALT_ROW);

    let x = MARGIN;
    const cells = [
      String(item.sort + 1),
      item.product,
      item.description || "",
      fmtNum(item.tons),
      item.unit,
      fmtUsd(item.pricePerTon),
      fmtUsd(lineTotal),
    ];
    cells.forEach((c, ci) => {
      drawText(page, c, x, y, COL_W[ci], ROW_H, {
        font: regularFont, size: 7.5, color: C_DARK, align: COL_ALIGNS[ci] as "left"|"right"|"center",
      });
      x += COL_W[ci];
    });

    // Cert badge (small text under product name)
    if (item.certType && item.certType !== "None") {
      const certStr = `${item.certType}${item.certDetail ? `  ${item.certDetail}` : ""}`;
      page.drawText(certStr, {
        x: MARGIN + COL_W[0] + 4,
        y: BY(y) - ROW_H + 3,
        size: 5.5, font: regularFont, color: C_TEAL,
      });
    }

    y += ROW_H;
  }

  // ── Totals row ─────────────────────────────────────────────────────────────
  const TOT_H = ROW_H + 2;
  if (y + TOT_H > MAX_Y) {
    pageNum++;
    [page, y] = addPage(pageNum);
  }
  hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 1);
  y += 1;
  fillRect(page, MARGIN, y, CONTENT_W, TOT_H, C_TOTALS_BG);

  // Label spans first 4 columns
  const labelW = COL_W.slice(0, 5).reduce((s, w) => s + w, 0);
  drawText(page, `TOTAL  (${items.length} line${items.length !== 1 ? "s" : ""})`, MARGIN, y, labelW, TOT_H, {
    font: boldFont, size: 7.5, color: C_DARK, align: "right",
  });
  // Unit total
  let tx = MARGIN + labelW;
  drawText(page, fmtUsd(grandTotal), tx, y, COL_W[5] + COL_W[6], TOT_H, {
    font: boldFont, size: 8, color: C_HEADER_BG, align: "right",
  });
  y += TOT_H + 10;

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (data.notes) {
    if (y + 50 > MAX_Y) {
      pageNum++;
      [page, y] = addPage(pageNum);
    }
    hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 0.5);
    y += 8;
    page.drawText("Notes & Terms:", { x: MARGIN, y: BY(y) - 7 * 0.716, size: 7, font: boldFont, color: C_DARK });
    y += 12;
    // Wrap notes text
    const words = data.notes.split(" ");
    let line = "";
    const LINE_H = 10;
    const MAX_LINE_W = CONTENT_W - 10;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (regularFont.widthOfTextAtSize(test, 7) > MAX_LINE_W) {
        page.drawText(line, { x: MARGIN, y: BY(y) - 7 * 0.716, size: 7, font: regularFont, color: C_GRAY });
        y += LINE_H;
        line = word;
        if (y + LINE_H > MAX_Y) {
          pageNum++;
          [page, y] = addPage(pageNum);
        }
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: MARGIN, y: BY(y) - 7 * 0.716, size: 7, font: regularFont, color: C_GRAY });
      y += LINE_H;
    }
  }

  // ── Footer on all pages ────────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  pages.forEach((pg, i) => drawFooter(pg, i, pages.length));

  return pdfDoc.save();
}

// ── GET /api/proposal-pdf?id=123 ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const id = parseInt(req.nextUrl.searchParams.get("id") || "");
    if (isNaN(id)) return new NextResponse("Missing id", { status: 400 });

    const bytes = await buildProposalPdf(id);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proposal-${id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return new NextResponse(`PDF error:\n${msg}`, { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}
