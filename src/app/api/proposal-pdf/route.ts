import { NextRequest, NextResponse } from "next/server";
import { buildProposalPdf } from "@/lib/proposal-pdf-builder";

export const dynamic = "force-dynamic";

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
