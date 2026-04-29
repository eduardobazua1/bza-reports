import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { getProposal } from "@/server/queries";

export const dynamic = "force-dynamic";

// ── Page constants ─────────────────────────────────────────────────────────────
const PAGE_W   = 612;
const PAGE_H   = 792;
const M        = 48;                   // same margin as invoice
const W        = PAGE_W - M * 2;      // 516 pt
const FOOTER_Y = 746;                  // footer bar starts here (matches invoice)
const MAX_Y    = FOOTER_Y - 6;        // last usable content y

// ── Brand colors (same as invoice-pdf) ────────────────────────────────────────
const TEAL  = rgb(0.051, 0.239, 0.231);   // #0d3d3b  dark teal
const CYAN  = rgb(0.310, 0.820, 0.773);   // #4fd1c5  light cyan
const TEALB = rgb(0.051, 0.580, 0.533);   // #0d9488  bright teal
const DARK  = rgb(0.11,  0.098, 0.09);
const GRAY  = rgb(0.42,  0.447, 0.502);
const LGRY  = rgb(0.953, 0.957, 0.965);
const RULE  = rgb(0.82,  0.835, 0.859);
const WHITE = rgb(1, 1, 1);
type RGB = ReturnType<typeof rgb>;

// ── Coordinate helpers ─────────────────────────────────────────────────────────
const BY = (y: number) => PAGE_H - y;
const RY = (y: number, h: number) => PAGE_H - y - h;

// ── Drawing helpers ────────────────────────────────────────────────────────────
function dr(p: PDFPage, x: number, pkY: number, w: number, h: number, color: RGB) {
  p.drawRectangle({ x, y: RY(pkY, h), width: w, height: h, color });
}
function dl(p: PDFPage, pkY: number) {
  p.drawLine({ start: { x: M, y: BY(pkY) }, end: { x: M + W, y: BY(pkY) }, thickness: 0.5, color: RULE });
}
function dt(p: PDFPage, text: string, x: number, pkY: number, size: number, f: PDFFont, color: RGB) {
  p.drawText(text, { x, y: BY(pkY) - size * 0.716, size, font: f, color });
}
function dtR(p: PDFPage, text: string, rx: number, pkY: number, size: number, f: PDFFont, color: RGB) {
  p.drawText(text, { x: rx - f.widthOfTextAtSize(text, size), y: BY(pkY) - size * 0.716, size, font: f, color });
}
function fit(s: string, maxW: number, f: PDFFont, sz: number): string {
  if (f.widthOfTextAtSize(s, sz) <= maxW) return s;
  while (s.length > 1 && f.widthOfTextAtSize(s + "…", sz) > maxW) s = s.slice(0, -1);
  return s + "…";
}
function wrap(text: string, maxW: number, f: PDFFont, sz: number): string[] {
  const words = text.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(test, sz) <= maxW) { cur = test; }
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Formatting ─────────────────────────────────────────────────────────────────
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTons(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const [yr, mo, da] = s.split("T")[0].split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[+mo - 1]} ${+da}, ${yr}`;
}

// ── Column definitions — must total W = 516 ────────────────────────────────────
// Product+Description merged into one wide "Item" column — no more truncation
const COLS: { label: string; w: number; align: "left" | "right" | "center" }[] = [
  { label: "#",           w: 20,  align: "center" },
  { label: "Item",        w: 232, align: "left"   },
  { label: "Qty",         w: 58,  align: "right"  },
  { label: "Unit",        w: 44,  align: "center" },
  { label: "Unit Price",  w: 74,  align: "right"  },
  { label: "Amount",      w: 88,  align: "right"  },
];
// auto-correct last column so columns exactly fill W
const COLS_SUM = COLS.reduce((s, c) => s + c.w, 0);
COLS[COLS.length - 1].w += W - COLS_SUM;

const HDR_H    = 17;
const ROW_BASE = 26;   // height with product name only
const DESC_EXT = 12;   // extra height when description is shown
const CERT_EXT = 11;   // extra height for cert pill

// ── Main builder ───────────────────────────────────────────────────────────────
export async function buildProposalPdf(proposalId: number): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const data = (await getProposal(proposalId))!;
  if (!data) throw new Error(`Proposal ${proposalId} not found`);

  const pdfDoc = await PDFDocument.create();
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Footer — same full dark-teal bar as invoice ────────────────────────────
  function drawFooter(page: PDFPage) {
    dr(page, 0, FOOTER_Y, PAGE_W, PAGE_H - FOOTER_Y, TEAL);
    const note = "This proposal is valid for the period indicated. All prices are stated in USD.";
    const nw = font.widthOfTextAtSize(note, 7);
    dt(page, note, (PAGE_W - nw) / 2, FOOTER_Y + 8, 7, font, CYAN);
    const contact = "BZA International Services, LLC  ·  accounting@bza-is.com  ·  www.bza-is.com";
    const cw = font.widthOfTextAtSize(contact, 7);
    dt(page, contact, (PAGE_W - cw) / 2, FOOTER_Y + 20, 7, font, WHITE);
  }

  // ── Column headers ─────────────────────────────────────────────────────────
  function drawColHeaders(page: PDFPage, y: number): number {
    dr(page, M, y, W, HDR_H, TEAL);
    let x = M;
    COLS.forEach(col => {
      const lbl = col.label.toUpperCase();
      const tw  = fontB.widthOfTextAtSize(lbl, 6.5);
      let dx = x + 4;
      if (col.align === "right")  dx = x + col.w - 4 - tw;
      if (col.align === "center") dx = x + (col.w - tw) / 2;
      dt(page, lbl, dx, y + 5, 6.5, fontB, WHITE);
      x += col.w;
    });
    return y + HDR_H;
  }

  // ── Page factory ───────────────────────────────────────────────────────────
  let pageNum = 0;

  function newPage(): [PDFPage, number] {
    pageNum++;
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = M;

    // Cyan accent bar (3 pt, same as invoice)
    dr(page, 0, 0, PAGE_W, 3, CYAN);

    // BZA. logo — 20 pt, matches invoice exactly
    const bzaW = fontB.widthOfTextAtSize("BZA", 20);
    dt(page, "BZA", M, y, 20, fontB, TEAL);
    dt(page, ".",   M + bzaW, y, 20, fontB, CYAN);

    if (pageNum === 1) {
      // Company info — right-aligned, 6 lines at 7 pt (same as invoice)
      const info = [
        "BZA International Services, LLC",
        "1209 S. 10th St. Suite A #583",
        "McAllen, TX 78501 US",
        "+1 520 331 7869",
        "accounting@bza-is.com",
        "www.bza-is.com",
      ];
      info.forEach((line, i) => {
        const tw = font.widthOfTextAtSize(line, 7);
        dt(page, line, M + W - tw, y + i * 9, 7, font, GRAY);
      });
      y += 66;

      dl(page, y); y += 12;

      // "PROPOSAL" left 22 pt + teal badge right (identical pattern to INVOICE badge)
      dt(page, "PROPOSAL", M, y, 22, fontB, TEAL);
      const BW = 150, BX = M + W - BW;
      dr(page, BX, y - 2, BW, 32, TEAL);
      dt(page, "PROPOSAL #", BX + 8, y + 3,  6.5, fontB, CYAN);
      dt(page, data.proposalNumber, BX + 8, y + 14, 9, fontB, WHITE);
      y += 40;

      // Meta strip — CLIENT | DATE | VALID UNTIL | INCOTERM | PAYMENT TERMS
      const COL5 = Math.floor(W / 5);
      const metas: { label: string; value: string }[] = [
        { label: "CLIENT",        value: data.client?.name  || "—" },
        { label: "DATE",          value: fmtDate(data.proposalDate) },
        { label: "VALID UNTIL",   value: fmtDate(data.validUntil)   },
        { label: "INCOTERM",      value: data.incoterm      || "—" },
        { label: "PAYMENT TERMS", value: data.paymentTerms  || "—" },
      ];
      // Labels row
      metas.forEach(({ label }, i) =>
        dt(page, label, M + i * COL5, y, 6, fontB, GRAY)
      );
      // Values row — wrap if needed
      metas.forEach(({ value }, i) =>
        wrap(value, COL5 - 4, font, 7.5).forEach((l, li) =>
          dt(page, l, M + i * COL5, y + 9 + li * 10, 7.5, font, DARK)
        )
      );
      y += 28;

      // Subtitle (proposal title) if meaningful
      if (data.title && data.title !== "Proposal") {
        dl(page, y); y += 8;
        dt(page, data.title, M, y, 8, font, GRAY);
        y += 14;
      }

      dl(page, y); y += 10;

    } else {
      // Continuation header
      dt(page, `${data.proposalNumber}  (continued)`,
        M + bzaW + 14, y + 4, 8.5, fontB, GRAY);
      dtR(page, `Page ${pageNum}`, M + W, y + 4, 8, font, GRAY);
      y += 28;
      dl(page, y); y += 10;
    }

    return [page, y];
  }

  // ── Build content ──────────────────────────────────────────────────────────
  let [page, y] = newPage();
  y = drawColHeaders(page, y);

  const items     = data.items ?? [];
  let grandTotal  = 0;

  for (let i = 0; i < items.length; i++) {
    const item      = items[i];
    const lineTotal = item.tons * item.pricePerTon;
    grandTotal     += lineTotal;

    const hasDesc = !!(item.description && item.description.trim() && item.description !== "—");
    const hasCert = !!(item.certType && item.certType !== "None" && item.certType !== "—");
    const rowH    = ROW_BASE + (hasDesc ? DESC_EXT : 0) + (hasCert ? CERT_EXT : 0);

    if (y + rowH > MAX_Y) {
      [page, y] = newPage();
      y = drawColHeaders(page, y);
    }

    // Alternating row background
    if (i % 2 === 1) dr(page, M, y, W, rowH, LGRY);

    // ── Col 0: row number — vertically centered
    const numTW = font.widthOfTextAtSize(String(i + 1), 7.5);
    const numX  = M + (COLS[0].w - numTW) / 2;
    const numY  = y + rowH / 2 - 7.5 * 0.716 / 2;
    dt(page, String(i + 1), numX, numY, 7.5, font, GRAY);

    // ── Col 1: Item — product name bold top, description small gray below
    const itemX  = M + COLS[0].w + 5;
    const itemW  = COLS[1].w - 10;

    // Product name — position depends on whether description follows
    const prodY = hasDesc || hasCert ? y + 7 : y + rowH / 2 - 8.5 * 0.716 / 2;
    dt(page, fit(item.product, itemW, fontB, 8.5), itemX, prodY, 8.5, fontB, TEAL);

    // Description sub-line
    if (hasDesc) {
      dt(page, fit(item.description!, itemW, font, 7), itemX, y + 7 + 12, 7, font, GRAY);
    }

    // Cert pill — sits below text content
    if (hasCert) {
      const certStr  = `${item.certType}${item.certDetail ? `  ${item.certDetail}` : ""}`;
      const certSz   = 5.5;
      const ctw      = fontB.widthOfTextAtSize(certStr, certSz);
      const pillW    = ctw + 8;
      const pillH    = 9;
      const textH    = ROW_BASE + (hasDesc ? DESC_EXT : 0);
      const pillX    = itemX;
      const pillY    = y + textH - CERT_EXT + 1;
      dr(page, pillX, pillY, pillW, pillH, TEAL);
      dt(page, certStr, pillX + 4, pillY + 1, certSz, fontB, WHITE);
    }

    // ── Cols 2-5: numeric cells — all vertically centered in full rowH
    type NumCell = { text: string; f: PDFFont; sz: number; color: RGB };
    const numCells: NumCell[] = [
      { text: fmtTons(item.tons),       f: fontB, sz: 8,   color: DARK  },
      { text: item.unit,                f: font,  sz: 8,   color: GRAY  },
      { text: fmtUsd(item.pricePerTon), f: font,  sz: 8,   color: DARK  },
      { text: fmtUsd(lineTotal),        f: fontB, sz: 8.5, color: TEALB },
    ];

    let x = M + COLS[0].w + COLS[1].w;
    numCells.forEach((c, ci) => {
      const colIdx = ci + 2;
      const cw     = COLS[colIdx].w;
      const txt    = fit(c.text, cw - 6, c.f, c.sz);
      const tw     = c.f.widthOfTextAtSize(txt, c.sz);
      const pkY    = y + rowH / 2 - c.sz * 0.716 / 2;
      const col    = COLS[colIdx];
      let   dx     = x + 4;
      if (col.align === "right")  dx = x + cw - 5 - tw;
      if (col.align === "center") dx = x + (cw - tw) / 2;
      dt(page, txt, dx, pkY, c.sz, c.f, c.color);
      x += cw;
    });

    y += rowH;
  }

  // ── Grand Total — full-width dark-teal block, matches BALANCE DUE in invoice
  const TOT_H = 32;
  if (y + TOT_H + 8 > MAX_Y) {
    [page, y] = newPage();
  }
  dl(page, y); y += 4;
  dr(page, M, y, W, TOT_H, TEAL);
  dt(page,  `GRAND TOTAL  (${items.length} item${items.length !== 1 ? "s" : ""})`,
    M + 10, y + 6, 6.5, fontB, CYAN);
  dtR(page, fmtUsd(grandTotal) + " USD",
    M + W - 10, y + 17, 11, fontB, WHITE);
  y += TOT_H + 16;

  // ── Notes & Terms ──────────────────────────────────────────────────────────
  if (data.notes) {
    if (y + 50 > MAX_Y) { [page, y] = newPage(); }
    dt(page, "NOTES & TERMS", M, y, 6.5, fontB, GRAY); y += 10;
    wrap(data.notes, W, font, 8).forEach(l => {
      dt(page, l, M, y, 8, font, DARK); y += 11;
    });
  }

  // ── Draw footer on every page ──────────────────────────────────────────────
  pdfDoc.getPages().forEach(pg => drawFooter(pg));

  return pdfDoc.save();
}

// ── Route handler ──────────────────────────────────────────────────────────────
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
