import { NextRequest, NextResponse } from "next/server";
import { buildGenericPdf, type InboundCol } from "@/lib/reports-pdf-builder";

export const dynamic = "force-dynamic";

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
