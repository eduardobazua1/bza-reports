import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSupplierPoPdf } from "@/lib/pdf-supplier-po";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const poId = sp.get("poId");
  const soId = sp.get("soId");
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, Number(poId)) });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  try {
    const buffer = await generateSupplierPoPdf(Number(poId), soId ? Number(soId) : null);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="SupplierPO_${po.poNumber}_BZA.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
}
