import { NextRequest, NextResponse } from "next/server";
import { buildSalesAgingReport } from "@/lib/sales-aging-report";

export const dynamic = "force-dynamic";

// Sales Aging Report (OPERATIONAL) — same columns/detail as the Control-Union-accepted 2025 report.
export async function GET(req: NextRequest) {
  const year = new URL(req.url).searchParams.get("year") || undefined;
  const { buffer, filename } = await buildSalesAgingReport(year);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
