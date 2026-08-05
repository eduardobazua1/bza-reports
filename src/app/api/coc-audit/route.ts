import { NextRequest, NextResponse } from "next/server";
import { buildCocAuditReport } from "@/lib/coc-audit";

export const dynamic = "force-dynamic";

// CoC Audit Validation Report (INTERNAL) — full validation columns.
export async function GET(req: NextRequest) {
  const year = new URL(req.url).searchParams.get("year") || undefined;
  const { buffer, filename } = await buildCocAuditReport(year);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
