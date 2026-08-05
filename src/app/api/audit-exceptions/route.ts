import { NextResponse } from "next/server";
import { buildExceptionReport } from "@/lib/coc-audit";

export const dynamic = "force-dynamic";

// Audit Exception Report — only operations whose Output Claim is not supported end-to-end.
export async function GET() {
  const { buffer, filename } = await buildExceptionReport();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
