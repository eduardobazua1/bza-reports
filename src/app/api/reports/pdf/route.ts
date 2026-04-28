import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";

export const dynamic = "force-dynamic";

// ── Page layout constants ──────────────────────────────────────────────────────
// Letter: 612 × 792 pt. Portrait.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2; // 532pt

const ROW_H = 16;
const HEADER_HEIGHT = 110; // space consumed by page 1 header (logo + title + rules)
const CONT_HEADER_HEIGHT = 30; // space consumed by continuation page header
const COL_HEADER_H = 16;
const FOOTER_H = 24; // space reserved at bottom for footer rule + text
const FONT_SIZE = 7;

// ── Color helpers ──────────────────────────────────────────────────────────────
type RGB = ReturnType<typeof rgb>;

// ── BZA brand palette ──────────────────────────────────────────────────────────
// #0d3d3b → rgb(13,61,59)   dark teal (header bar, logo BZA)
// #0d9488 → rgb(13,148,136) teal      (logo dot, totals accent)
// #4fd1c5 → rgb(79,209,197) cyan      (logo dot accent)
const C_BLACK    = rgb(0, 0, 0);
const C_DARK     = rgb(0.11, 0.09, 0.09);               // stone-900
const C_GRAY     = rgb(0.4, 0.4, 0.4);
const C_RULE     = rgb(0.82, 0.82, 0.82);
const C_HEADER_BG = rgb(0.051, 0.239, 0.231);           // #0d3d3b
const C_TEAL     = rgb(0.051, 0.580, 0.533);            // #0d9488
const C_TEAL_LIGHT = rgb(0.310, 0.820, 0.773);          // #4fd1c5
const C_ALT_ROW  = rgb(0.97, 0.98, 0.98);               // very light teal tint
const C_TOTALS_BG = rgb(0.90, 0.96, 0.95);              // teal-tinted totals bg
const C_WHITE    = rgb(1, 1, 1);

// ── Coordinate helpers ─────────────────────────────────────────────────────────
// pdf-lib has y=0 at bottom. We work in "top-origin" coordinates internally.
// pkY = distance from top of page (positive down).
const BY = (pkY: number) => PAGE_H - pkY;
const RY = (pkY: number, h: number) => PAGE_H - pkY - h;

// ── Column definition (as received from the client) ───────────────────────────
type InboundCol = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "text" | "currency" | "date" | "number" | "percent" | "status";
};

// ── Formatting (mirrors the client-side formatCell) ───────────────────────────
function formatCellPdf(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "currency": {
      const n = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(n)) return String(value);
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "date": {
      const s = String(value);
      if (!s) return "—";
      const parts = s.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}/${parts[0]}`;
      }
      return s;
    }
    case "number": {
      const n = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(n)) return String(value);
      return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "percent": {
      const n = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(n)) return String(value);
      return n.toFixed(1) + "%";
    }
    case "status":
      return value ? String(value).replace(/_/g, " ") : "—";
    default:
      return value !== null && value !== undefined ? String(value) : "—";
  }
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function fillRect(page: PDFPage, x: number, pkY: number, w: number, h: number, color: RGB) {
  page.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
}

function hline(page: PDFPage, x1: number, pkY: number, x2: number, color: RGB, thickness = 0.5) {
  page.drawLine({
    start: { x: x1, y: BY(pkY) },
    end: { x: x2, y: BY(pkY) },
    thickness,
    color,
  });
}

function fitText(text: string, maxW: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + "\u2026", size) > maxW) {
    s = s.slice(0, -1);
  }
  return s + "\u2026";
}

function drawCell(
  page: PDFPage,
  text: string,
  x: number,
  pkY: number,
  w: number,
  rowH: number,
  opts: { font: PDFFont; size: number; color: RGB; align?: "left" | "right" | "center" },
) {
  const { font, size, color, align } = opts;
  const pad = 3;
  const inner = w - pad * 2;
  const str = fitText(text, inner, font, size);
  const tw = font.widthOfTextAtSize(str, size);
  let drawX: number;
  if (align === "right") {
    drawX = x + w - pad - tw;
  } else if (align === "center") {
    drawX = x + (w - tw) / 2;
  } else {
    drawX = x + pad;
  }
  const capH = size * 0.716;
  const rowMidY = BY(pkY) - rowH / 2;
  const baselineY = rowMidY - capH / 2;
  page.drawText(str, { x: drawX, y: baselineY, size, font, color });
}

// ── Page header (page 1) ───────────────────────────────────────────────────────
// Returns pkY after the header area (start of table).
function drawFirstPageHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  title: string,
  subtitle?: string,
  dateLabel?: string,
): number {
  let y = MARGIN;

  // ── BZA Logo ────────────────────────────────────────────────────────────────
  // Draw "BZA" in dark teal + "." in teal, centered
  const LOGO_SIZE = 16;
  const bzaText = "BZA";
  const dotText = ".";
  const bzaW  = fonts.bold.widthOfTextAtSize(bzaText, LOGO_SIZE);
  const dotW  = fonts.bold.widthOfTextAtSize(dotText, LOGO_SIZE);
  const logoW = bzaW + dotW;
  const logoX = (PAGE_W - logoW) / 2;
  const logoBaseline = BY(y) - LOGO_SIZE * 0.716;
  page.drawText(bzaText, { x: logoX,        y: logoBaseline, size: LOGO_SIZE, font: fonts.bold, color: C_HEADER_BG });
  page.drawText(dotText, { x: logoX + bzaW, y: logoBaseline, size: LOGO_SIZE, font: fonts.bold, color: C_TEAL_LIGHT });
  y += LOGO_SIZE + 4;

  // Company subtitle
  const companyName = "International Services";
  const companyW = fonts.regular.widthOfTextAtSize(companyName, 6.5);
  page.drawText(companyName, {
    x: (PAGE_W - companyW) / 2,
    y: BY(y) - 6.5 * 0.716,
    size: 6.5,
    font: fonts.regular,
    color: C_GRAY,
  });
  y += 10;

  // Thin teal rule under logo
  hline(page, PAGE_W / 2 - 30, y, PAGE_W / 2 + 30, C_TEAL, 1);
  y += 8;

  // Report title (bold, centered)
  const titleSize = 13;
  const titleW = fonts.bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_W - titleW) / 2,
    y: BY(y) - titleSize * 0.716,
    size: titleSize,
    font: fonts.bold,
    color: C_DARK,
  });
  y += titleSize + 4;

  // Subtitle (if any)
  if (subtitle && subtitle !== "BZA International Services") {
    const subW = fonts.regular.widthOfTextAtSize(subtitle, 7);
    page.drawText(subtitle, {
      x: (PAGE_W - subW) / 2,
      y: BY(y) - 7 * 0.716,
      size: 7,
      font: fonts.regular,
      color: C_GRAY,
    });
    y += 11;
  }

  // Date label (if any)
  if (dateLabel) {
    const dlW = fonts.regular.widthOfTextAtSize(dateLabel, 7);
    page.drawText(dateLabel, {
      x: (PAGE_W - dlW) / 2,
      y: BY(y) - 7 * 0.716,
      size: 7,
      font: fonts.regular,
      color: C_GRAY,
    });
    y += 11;
  }

  // Full-width rule below header
  y += 4;
  hline(page, MARGIN, y, PAGE_W - MARGIN, C_TEAL, 0.75);
  y += 8;

  return y;
}

// ── Continuation page header ───────────────────────────────────────────────────
function drawContinuationHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  title: string,
  pageNum: number,
): number {
  const y = MARGIN;
  // Mini logo
  const LSIZE = 9;
  page.drawText("BZA", { x: MARGIN, y: BY(y) - LSIZE * 0.716, size: LSIZE, font: fonts.bold, color: C_HEADER_BG });
  const dotX = MARGIN + fonts.bold.widthOfTextAtSize("BZA", LSIZE);
  page.drawText(".", { x: dotX, y: BY(y) - LSIZE * 0.716, size: LSIZE, font: fonts.bold, color: C_TEAL_LIGHT });

  // Title (cont.)
  const contX = dotX + fonts.bold.widthOfTextAtSize(".", LSIZE) + 8;
  page.drawText(`${title} (cont.)`, {
    x: contX,
    y: BY(y) - 8 * 0.716,
    size: 8,
    font: fonts.bold,
    color: C_DARK,
  });
  const pgStr = `Page ${pageNum}`;
  const pgW = fonts.regular.widthOfTextAtSize(pgStr, 7);
  page.drawText(pgStr, {
    x: PAGE_W - MARGIN - pgW,
    y: BY(y) - 7 * 0.716,
    size: 7,
    font: fonts.regular,
    color: C_GRAY,
  });
  hline(page, MARGIN, y + CONT_HEADER_HEIGHT - 4, PAGE_W - MARGIN, C_TEAL, 0.5);
  return y + CONT_HEADER_HEIGHT;
}

// ── Column header row ──────────────────────────────────────────────────────────
function drawColumnHeaders(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  pkY: number,
  cols: InboundCol[],
  widths: number[],
): number {
  fillRect(page, MARGIN, pkY, CONTENT_W, COL_HEADER_H, C_HEADER_BG);
  let x = MARGIN;
  cols.forEach((col, i) => {
    drawCell(page, col.label.toUpperCase(), x, pkY, widths[i], COL_HEADER_H, {
      font: fonts.bold,
      size: 6,
      color: C_WHITE,
      align: col.align,
    });
    x += widths[i];
  });
  return pkY + COL_HEADER_H;
}

// ── Page footer ────────────────────────────────────────────────────────────────
function drawPageFooter(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  pageIndex: number,
  totalPages: number,
  generatedAt: string,
) {
  const fy = PAGE_H - MARGIN + 4;
  hline(page, MARGIN, fy, PAGE_W - MARGIN, C_RULE, 0.5);

  const left = `Generated ${generatedAt}`;
  page.drawText(left, {
    x: MARGIN,
    y: BY(fy + 10) - 6 * 0.716,
    size: 6,
    font: fonts.regular,
    color: C_GRAY,
  });

  const right = `Page ${pageIndex + 1} of ${totalPages}`;
  const rw = fonts.regular.widthOfTextAtSize(right, 6);
  page.drawText(right, {
    x: PAGE_W - MARGIN - rw,
    y: BY(fy + 10) - 6 * 0.716,
    size: 6,
    font: fonts.regular,
    color: C_GRAY,
  });
}

// ── Column width calculator ────────────────────────────────────────────────────
// Numeric/currency/percent columns get a narrower weight; text columns get wider.
function computeWidths(cols: InboundCol[]): number[] {
  const MIN_COL = 50;
  const weights = cols.map((c) => {
    if (c.format === "currency" || c.format === "number" || c.format === "percent") return 0.8;
    if (c.format === "date") return 0.85;
    return 1;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const rawWidths = weights.map((w) => Math.max(MIN_COL, Math.floor((w / totalWeight) * CONTENT_W)));
  // Adjust last column to fill exactly
  const sumBut = rawWidths.slice(0, -1).reduce((s, w) => s + w, 0);
  rawWidths[rawWidths.length - 1] = Math.max(MIN_COL, CONTENT_W - sumBut);
  return rawWidths;
}

// ── Core PDF builder ───────────────────────────────────────────────────────────

export async function buildGenericPdf(payload: {
  title: string;
  subtitle?: string;
  dateLabel?: string;
  columns: InboundCol[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  totalsLabel?: string;
}): Promise<Uint8Array> {
  const { title, subtitle, dateLabel, columns, rows, totals, totalsLabel } = payload;

  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold: boldFont, regular: regularFont };

  const cols = columns.length > 0 ? columns : [{ key: "__empty", label: "Data" }];
  const widths = computeWidths(cols);

  const now = new Date();
  const generatedAt = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Bottom boundary: leave room for footer
  const MAX_Y = PAGE_H - MARGIN - FOOTER_H;

  let pageNum = 1;
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = drawFirstPageHeader(page, fonts, title, subtitle, dateLabel);
  y = drawColumnHeaders(page, fonts, y, cols, widths);

  for (let ri = 0; ri < rows.length; ri++) {
    // Page overflow check
    if (y + ROW_H > MAX_Y) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = drawContinuationHeader(page, fonts, title, pageNum);
      y = drawColumnHeaders(page, fonts, y, cols, widths);
    }

    // Alternate row background
    if (ri % 2 === 1) {
      fillRect(page, MARGIN, y, CONTENT_W, ROW_H, C_ALT_ROW);
    }

    const row = rows[ri];
    let x = MARGIN;
    cols.forEach((col, ci) => {
      const cellVal = formatCellPdf(row[col.key], col.format);
      drawCell(page, cellVal, x, y, widths[ci], ROW_H, {
        font: regularFont,
        size: FONT_SIZE,
        color: C_DARK,
        align: col.align,
      });
      x += widths[ci];
    });
    y += ROW_H;
  }

  // Totals row
  if (totals) {
    const TOT_H = ROW_H + 2;
    if (y + TOT_H > MAX_Y) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = drawContinuationHeader(page, fonts, title, pageNum);
    }
    hline(page, MARGIN, y, PAGE_W - MARGIN, C_RULE, 1);
    y += 1;
    fillRect(page, MARGIN, y, CONTENT_W, TOT_H, C_TOTALS_BG);

    let x = MARGIN;
    cols.forEach((col, ci) => {
      let cellStr: string;
      if (ci === 0 && totalsLabel) {
        cellStr = totalsLabel;
      } else {
        const val = totals[col.key];
        cellStr = val !== undefined && val !== null ? formatCellPdf(val, col.format) : "";
      }
      if (cellStr) {
        drawCell(page, cellStr, x, y, widths[ci], TOT_H, {
          font: boldFont,
          size: FONT_SIZE,
          color: C_DARK,
          align: col.align,
        });
      }
      x += widths[ci];
    });
  }

  // Draw footer on every page
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((pg, i) => {
    drawPageFooter(pg, fonts, i, totalPages, generatedAt);
  });

  return pdfDoc.save();
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title = "Report", ...rest } = body as {
      title: string;
      subtitle?: string;
      dateLabel?: string;
      columns: InboundCol[];
      rows: Record<string, unknown>[];
      totals?: Record<string, unknown>;
      totalsLabel?: string;
    };

    const pdfBytes = await buildGenericPdf({ title, ...rest });

    const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, "_");

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    return new NextResponse(`PDF generation failed:\n\n${msg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
