import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { writeFileSync, readFileSync, mkdtempSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// Render a PDF to one base64 PNG data-URL per page using scripts/pdf-to-images.py
// (PyMuPDF). This is what lets the AI READ scanned PDFs via Claude vision.
async function renderPdfToImageUrls(pdfPath: string, maxPages = 12): Promise<string[]> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const outDir = mkdtempSync(join(tmpdir(), "bza-pdfimg-"));
  const scriptPath = join(process.cwd(), "scripts", "pdf-to-images.py");
  try {
    const { stdout } = await execFileAsync(
      "python3",
      [scriptPath, pdfPath, outDir, String(maxPages)],
      { timeout: 60000 }
    );
    const pngPaths = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    const urls: string[] = [];
    for (const p of pngPaths) {
      if (existsSync(p)) {
        const b64 = readFileSync(p).toString("base64");
        urls.push(`data:image/png;base64,${b64}`);
      }
    }
    return urls;
  } finally {
    // best-effort cleanup of the rendered PNGs (the source PDF temp is kept for tools)
    try { rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // Excel / CSV files — parse to text
    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const results: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];

        results.push(`Sheet: ${sheetName} (${data.length} rows)`);

        const rows = data.slice(0, 80).map((row) =>
          (row as unknown[]).map((cell) => (cell !== null && cell !== undefined ? String(cell) : "")).join("\t")
        );
        results.push(rows.join("\n"));

        if (data.length > 80) {
          results.push(`... and ${data.length - 80} more rows`);
        }
      }

      return NextResponse.json({
        type: "text",
        parsedContent: results.join("\n\n"),
        fileName: file.name,
        fileSize: file.size,
      });
    }

    // PDF files — ALWAYS render to images (so the AI can read scanned PDFs via
    // vision), plus extract any embedded text as extra context.
    if (fileName.endsWith(".pdf")) {
      // Save raw PDF to temp file for downstream tools (attach as bl/pl, SI page 1, etc.)
      const tempPath = join(tmpdir(), `bza-${randomUUID()}.pdf`);
      writeFileSync(tempPath, buffer);

      // 1) Extract embedded text (best-effort; empty for scanned docs)
      let text = "";
      let numPages = 0;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        text = (data.text || "").trim();
        numPages = data.numpages || 0;
      } catch { /* scanned/无 text — handled by image render below */ }

      // 2) Render to images so the model can SEE the document
      let imageUrls: string[] = [];
      let renderError = "";
      try {
        imageUrls = await renderPdfToImageUrls(tempPath);
      } catch (e) {
        renderError = e instanceof Error ? e.message : "render failed";
      }

      const textPart = text.length > 0
        ? `Embedded text (may be partial):\n${text.length > 8000 ? text.slice(0, 8000) + "\n... (truncated)" : text}`
        : (imageUrls.length > 0
            ? "Scanned PDF — read it from the attached page image(s)."
            : `Could not extract text or render images${renderError ? `: ${renderError}` : ""}.`);

      return NextResponse.json({
        type: imageUrls.length > 0 ? "pdf" : "text",
        parsedContent: `PDF: ${file.name} (${numPages || imageUrls.length} page${(numPages || imageUrls.length) !== 1 ? "s" : ""})\n\n${textPart}`,
        imageUrls,
        fileName: file.name,
        fileSize: file.size,
        tempPath,
      });
    }

    // Image files — convert to base64 for GPT-4o vision
    if (fileName.match(/\.(png|jpg|jpeg|gif|webp)$/)) {
      const mimeType = fileName.endsWith(".png") ? "image/png"
        : fileName.endsWith(".gif") ? "image/gif"
        : fileName.endsWith(".webp") ? "image/webp"
        : "image/jpeg";

      const base64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return NextResponse.json({
        type: "image",
        imageUrl: dataUrl,
        parsedContent: `Image attached: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
        fileName: file.name,
        fileSize: file.size,
      });
    }

    return NextResponse.json({ error: `Unsupported file type: ${fileName}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: `Error processing file: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
