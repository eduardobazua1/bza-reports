import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { getProposal } from "@/server/queries";

export const dynamic = "force-dynamic";

// ── Page constants ─────────────────────────────────────────────────────────────
const PAGE_W    = 612;
const PAGE_H    = 792;
const MARGIN    = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;   // 512 pt
const FOOTER_H  = 28;
const MAX_Y     = PAGE_H - MARGIN - FOOTER_H;

// ── Brand colors ───────────────────────────────────────────────────────────────
const C_DARK       = rgb(0.10, 0.08, 0.08);
const C_MED        = rgb(0.30, 0.28, 0.28);
const C_GRAY       = rgb(0.50, 0.50, 0.50);
const C_HEADER_BG  = rgb(0.051, 0.239, 0.231);   // #0d3d3b
const C_TEAL       = rgb(0.051, 0.580, 0.533);   // #0d9488
const C_TEAL_LIGHT = rgb(0.310, 0.820, 0.773);   // #4fd1c5
const C_ALT_ROW    = rgb(0.974, 0.980, 0.980);
const C_TOTAL_BG   = rgb(0.880, 0.960, 0.945);
const C_RULE       = rgb(0.840, 0.840, 0.840);
const C_WHITE      = rgb(1, 1, 1);
type RGB = ReturnType<typeof rgb>;

// ── Coordinate helpers (top-origin → pdf-lib bottom-origin) ───────────────────
const BY = (y: number) => PAGE_H - y;
const RY = (y: number, h: number) => PAGE_H - y - h;

// ── Drawing primitives ─────────────────────────────────────────────────────────
function rect(p: PDFPage, x: number, y: number, w: number, h: number, c: RGB) {
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
function cell(
  p: PDFPage, text: string,
  x: number, y: number, w: number, h: number,
  opts: { font: PDFFont; size: number; color: RGB; align?: "left" | "right" | "center"; padX?: number },
) {
  const { font, size, color, align = "left", padX = 6 } = opts;
  const inner = w - padX * 2;
  const s   = fitText(text, inner, font, size);
  const tw  = font.widthOfTextAtSize(s, size);
  const capH = size * 0.72;
  const baseY = BY(y) - h / 2 - capH / 2;
  let drawX = x + padX;
  if (align === "right")  drawX = x + w - padX - tw;
  if (align === "center") drawX = x + (w - tw) / 2;
  p.drawText(s, { x: drawX, y: baseY, size, font, color });
}

// ── Formatting ─────────────────────────────────────────────────────────────────
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTons(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

// ── Column definitions ─────────────────────────────────────────────────────────
// # | Product | Description | Qty | Unit | Unit Price | Amount
// Total must equal CONTENT_W (512)
const COLS = [
  { label: "#",           w: 22,  align: "center" },
  { label: "Product",     w: 148, align: "left"   },
  { label: "Description", w: 130, align: "left"   },
  { label: "Qty",         w: 52,  align: "right"  },
  { label: "Unit",        w: 42,  align: "center" },
  { label: "Unit Price",  w: 62,  align: "right"  },
  { label: "Amount",      w: 56,  align: "right"  },
] as const;
// Verify and adjust last column to fill exactly
const SUM_DEFINED = COLS.reduce((s, c) => s + c.w, 0);
const COL_W = COLS.map(c => c.w) as number[];
COL_W[COL_W.length - 1] = CONTENT_W - SUM_DEFINED + COLS[COLS.length - 1].w;

const ROW_H  = 26;   // data row height
const HDR_H  = 20;   // column header row height

// ── Main builder ───────────────────────────────────────────────────────────────
export async function buildProposalPdf(proposalId: number): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const data = (await getProposal(proposalId))!;
  if (!data) throw new Error(`Proposal ${proposalId} not found`);

  const pdfDoc   = await PDFDocument.create();
  const bold     = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ── Page factory ─────────────────────────────────────────────────────────────
  function newPage(pageNum: number): [PDFPage, number] {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = MARGIN;

    // Top cyan accent bar
    rect(page, 0, 0, PAGE_W, 4, C_TEAL);
    y += 4;

    if (pageNum === 1) {
      // ── BZA. logo ──────────────────────────────────────────────────────────
      const LSIZ = 16;
      const CAP  = 0.72;
      const bzaW = bold.widthOfTextAtSize("BZA", LSIZ);
      page.drawText("BZA", { x: MARGIN, y: BY(y + 6) - LSIZ * CAP, size: LSIZ, font: bold, color: C_HEADER_BG });
      page.drawText(".",   { x: MARGIN + bzaW, y: BY(y + 6) - LSIZ * CAP, size: LSIZ, font: bold, color: C_TEAL_LIGHT });

      // ── Company info right ─────────────────────────────────────────────────
      const info = ["BZA International Services, LLC", "accounting@bza-is.com  ·  www.bza-is.com"];
      info.forEach((line, i) => {
        const lw = regular.widthOfTextAtSize(line, 7.5);
        page.drawText(line, { x: PAGE_W - MARGIN - lw, y: BY(y + 5 + i * 11) - 7.5 * CAP, size: 7.5, font: regular, color: C_GRAY });
      });

      y += 32;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_TEAL, 1.5);
      y += 14;

      // ── PROPOSAL heading ───────────────────────────────────────────────────
      const headStr = "PROPOSAL";
      const headSz  = 20;
      const headW   = bold.widthOfTextAtSize(headStr, headSz);
      page.drawText(headStr, { x: (PAGE_W - headW) / 2, y: BY(y) - headSz * 0.72, size: headSz, font: bold, color: C_HEADER_BG });
      y += headSz + 6;

      // Proposal number
      const numStr = data.proposalNumber;
      const numSz  = 10;
      const numW   = regular.widthOfTextAtSize(numStr, numSz);
      page.drawText(numStr, { x: (PAGE_W - numW) / 2, y: BY(y) - numSz * 0.72, size: numSz, font: regular, color: C_TEAL });
      y += numSz + 4;

      // Proposal title (if set)
      if (data.title && data.title !== "Proposal") {
        const titSz = 10;
        const titW  = regular.widthOfTextAtSize(data.title, titSz);
        page.drawText(data.title, { x: (PAGE_W - titW) / 2, y: BY(y) - titSz * 0.72, size: titSz, font: regular, color: C_MED });
        y += titSz + 4;
      }

      y += 8;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 0.5);
      y += 16;

      // ── Metadata block ─────────────────────────────────────────────────────
      // Two side-by-side columns, each with a box
      const MID      = PAGE_W / 2;
      const COL_PAD  = 12;
      const BOX_W    = MID - MARGIN - 8;
      const LSIZ2    = 7.5;
      const VSIZ     = 9;
      const LH       = 20;   // line height per meta entry

      const col1: [string, string][] = [
        ["Client",        data.client?.name || "—"],
        ["Proposal Date", fmtDate(data.proposalDate)],
        ["Valid Until",   fmtDate(data.validUntil)],
      ];
      const col2: [string, string][] = [
        ["Incoterm",      data.incoterm     || "—"],
        ["Payment Terms", data.paymentTerms || "—"],
        ["Status",        (data.status || "draft").charAt(0).toUpperCase() + (data.status || "draft").slice(1)],
      ];

      const boxH = col1.length * LH + 16;

      // Draw light boxes for each column
      rect(page, MARGIN,     y, BOX_W, boxH, rgb(0.975, 0.980, 0.980));
      rect(page, MID + 8,    y, BOX_W, boxH, rgb(0.975, 0.980, 0.980));

      col1.forEach(([label, value], i) => {
        const ry = y + 10 + i * LH;
        page.drawText(label.toUpperCase(), { x: MARGIN + COL_PAD, y: BY(ry) - LSIZ2 * 0.72, size: LSIZ2, font: regular, color: C_GRAY });
        page.drawText(fitText(value, BOX_W - COL_PAD * 2, bold, VSIZ), { x: MARGIN + COL_PAD, y: BY(ry + 10) - VSIZ * 0.72, size: VSIZ, font: bold, color: C_DARK });
      });

      col2.forEach(([label, value], i) => {
        const ry = y + 10 + i * LH;
        page.drawText(label.toUpperCase(), { x: MID + 8 + COL_PAD, y: BY(ry) - LSIZ2 * 0.72, size: LSIZ2, font: regular, color: C_GRAY });
        page.drawText(fitText(value, BOX_W - COL_PAD * 2, bold, VSIZ), { x: MID + 8 + COL_PAD, y: BY(ry + 10) - VSIZ * 0.72, size: VSIZ, font: bold, color: C_DARK });
      });

      y += boxH + 20;

    } else {
      // ── Continuation header ────────────────────────────────────────────────
      const LSIZ = 10;
      const CAP  = 0.72;
      const bzaW = bold.widthOfTextAtSize("BZA", LSIZ);
      page.drawText("BZA", { x: MARGIN, y: BY(y + 4) - LSIZ * CAP, size: LSIZ, font: bold, color: C_HEADER_BG });
      page.drawText(".",   { x: MARGIN + bzaW, y: BY(y + 4) - LSIZ * CAP, size: LSIZ, font: bold, color: C_TEAL_LIGHT });
      const contStr = `${data.proposalNumber}  (cont.)`;
      page.drawText(contStr, { x: MARGIN + bzaW + 8, y: BY(y + 5) - 9 * CAP, size: 9, font: bold, color: C_MED });
      const pgStr = `Page ${pageNum}`;
      const pgW   = regular.widthOfTextAtSize(pgStr, 8);
      page.drawText(pgStr, { x: PAGE_W - MARGIN - pgW, y: BY(y + 5) - 8 * CAP, size: 8, font: regular, color: C_GRAY });
      y += 26;
      hline(page, MARGIN, y, PAGE_W - MARGIN, C_TEAL, 0.75);
      y += 12;
    }

    return [page, y];
  }

  // ── Column header row ─────────────────────────────────────────────────────────
  function drawColHeaders(page: PDFPage, y: number): number {
    rect(page, MARGIN, y, CONTENT_W, HDR_H, C_HEADER_BG);
    let x = MARGIN;
    COLS.forEach((col, i) => {
      cell(page, col.label.toUpperCase(), x, y, COL_W[i], HDR_H, {
        font: bold, size: 7, color: C_WHITE, align: col.align as "left"|"right"|"center", padX: 6,
      });
      x += COL_W[i];
    });
    return y + HDR_H;
  }

  // ── Page footer ───────────────────────────────────────────────────────────────
  function drawFooter(page: PDFPage, pageIdx: number, total: number) {
    const fy = PAGE_H - MARGIN + 6;
    hline(page, MARGIN, fy, PAGE_W - MARGIN, C_RULE, 0.5);
    const genStr = `Generated ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    page.drawText(genStr, { x: MARGIN, y: BY(fy + 14) - 6.5 * 0.72, size: 6.5, font: regular, color: C_GRAY });
    const pgStr = `Page ${pageIdx + 1} of ${total}`;
    const pgW   = regular.widthOfTextAtSize(pgStr, 6.5);
    page.drawText(pgStr, { x: PAGE_W - MARGIN - pgW, y: BY(fy + 14) - 6.5 * 0.72, size: 6.5, font: regular, color: C_GRAY });
  }

  // ── Build content ─────────────────────────────────────────────────────────────
  let pageNum = 1;
  let [page, y] = newPage(pageNum);
  y = drawColHeaders(page, y);

  const items      = data.items ?? [];
  let   grandTotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item      = items[i];
    const lineTotal = item.tons * item.pricePerTon;
    grandTotal     += lineTotal;

    // Has cert badge → needs extra vertical space
    const hasCert  = !!(item.certType && item.certType !== "None" && item.certType !== "—");
    const rowH     = hasCert ? ROW_H + 10 : ROW_H;

    if (y + rowH > MAX_Y) {
      pageNum++;
      [page, y] = newPage(pageNum);
      y = drawColHeaders(page, y);
    }

    // Alternating row bg
    if (i % 2 === 1) rect(page, MARGIN, y, CONTENT_W, rowH, C_ALT_ROW);

    // Per-column style: size, font, color for visual hierarchy
    const rowCells: { text: string; font: PDFFont; size: number; color: RGB; align: string }[] = [
      { text: String(i + 1),            font: regular, size: 7.5, color: C_GRAY,       align: COLS[0].align },
      { text: item.product,             font: bold,    size: 9,   color: C_HEADER_BG,  align: COLS[1].align },
      { text: item.description || "—",  font: regular, size: 7.5, color: C_GRAY,       align: COLS[2].align },
      { text: fmtTons(item.tons),       font: bold,    size: 8.5, color: C_DARK,       align: COLS[3].align },
      { text: item.unit,                font: regular, size: 8,   color: C_MED,        align: COLS[4].align },
      { text: fmtUsd(item.pricePerTon), font: regular, size: 8.5, color: C_MED,        align: COLS[5].align },
      { text: fmtUsd(lineTotal),        font: bold,    size: 9.5, color: C_TEAL,       align: COLS[6].align },
    ];

    let x = MARGIN;
    rowCells.forEach((c, ci) => {
      cell(page, c.text, x, y, COL_W[ci], hasCert ? ROW_H : rowH, {
        font: c.font, size: c.size, color: c.color, align: c.align as "left"|"right"|"center",
      });
      x += COL_W[ci];
    });

    // Cert badge pill underneath product name
    if (hasCert) {
      const certStr = `${item.certType}${item.certDetail ? `  ${item.certDetail}` : ""}`;
      const certSz  = 5.5;
      const certTW  = bold.widthOfTextAtSize(certStr, certSz);
      const pillW   = certTW + 7;
      const pillH   = 8;
      const pillX   = MARGIN + COL_W[0] + 5;
      const pillY   = y + ROW_H + 2;
      rect(page, pillX, pillY, pillW, pillH, C_TEAL);
      page.drawText(certStr, {
        x: pillX + 3.5,
        y: BY(pillY + 1) - certSz * 0.72,
        size: certSz, font: bold, color: C_WHITE,
      });
    }

    y += rowH;
  }

  // ── Totals ────────────────────────────────────────────────────────────────────
  const TOT_H = ROW_H + 4;
  if (y + TOT_H + 4 > MAX_Y) {
    pageNum++;
    [page, y] = newPage(pageNum);
  }
  y += 2;
  hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 1);
  y += 1;
  rect(page, MARGIN, y, CONTENT_W, TOT_H, C_TOTAL_BG);

  // "TOTAL" label spans columns 0-5
  const labelSpanW = COL_W.slice(0, 6).reduce((s, w) => s + w, 0);
  cell(page, `TOTAL  (${items.length} line${items.length !== 1 ? "s" : ""})`,
    MARGIN, y, labelSpanW, TOT_H, { font: bold, size: 8.5, color: C_MED, align: "right" });

  // Amount — prominent, right-most column only
  const amtX = MARGIN + labelSpanW;
  const amtW = COL_W[6];
  cell(page, fmtUsd(grandTotal), amtX, y, amtW, TOT_H, { font: bold, size: 11, color: C_HEADER_BG, align: "right" });
  y += TOT_H + 16;

  // ── Notes & Terms ─────────────────────────────────────────────────────────────
  if (data.notes) {
    if (y + 60 > MAX_Y) {
      pageNum++;
      [page, y] = newPage(pageNum);
    }
    hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 0.5);
    y += 12;

    // Teal accent bar + section label
    rect(page, MARGIN, y, 3, 10, C_TEAL);
    page.drawText("NOTES & TERMS", { x: MARGIN + 8, y: BY(y) - 8 * 0.72, size: 8, font: bold, color: C_HEADER_BG });
    y += 18;

    // Word-wrap notes
    const words   = data.notes.split(" ");
    let   line    = "";
    const LH      = 13;
    const MAX_W   = CONTENT_W;
    const NOTE_SZ = 8.5;

    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (regular.widthOfTextAtSize(test, NOTE_SZ) > MAX_W) {
        page.drawText(line, { x: MARGIN, y: BY(y) - NOTE_SZ * 0.72, size: NOTE_SZ, font: regular, color: C_MED });
        y += LH;
        line = word;
        if (y + LH > MAX_Y) { pageNum++; [page, y] = newPage(pageNum); }
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: MARGIN, y: BY(y) - NOTE_SZ * 0.72, size: NOTE_SZ, font: regular, color: C_MED });
    }
  }

  // ── Footers ───────────────────────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  pages.forEach((pg, i) => drawFooter(pg, i, pages.length));

  return pdfDoc.save();
}

// ── Route handler ─────────────────────────────────────────────────────────────
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
