import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

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

    // PDF files — extract text
    if (fileName.endsWith(".pdf")) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require("pdf-parse");
      const uint8 = new Uint8Array(buffer);
      const parser = new PDFParse(uint8);
      await parser.load();
      const result = await parser.getText();
      const text = (result.text || "").trim();
      const numPages = result.total || 0;

      if (text.length === 0) {
        return NextResponse.json({
          type: "text",
          parsedContent: `PDF file: ${file.name} (${numPages} pages). Could not extract text — this PDF may contain only scanned images. Try uploading a screenshot instead so I can read it with vision.`,
          fileName: file.name,
          fileSize: file.size,
        });
      }

      // Limit to ~8000 chars to fit in context
      const truncated = text.length > 8000 ? text.slice(0, 8000) + "\n... (truncated)" : text;

      return NextResponse.json({
        type: "text",
        parsedContent: `PDF: ${file.name} (${numPages} pages)\n\n${truncated}`,
        fileName: file.name,
        fileSize: file.size,
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
