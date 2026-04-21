import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const invoiceNumber = req.nextUrl.searchParams.get("invoice");
  if (!invoiceNumber) return NextResponse.json({ error: "invoice param required" }, { status: 400 });

  try {
    const pdfBuffer = await generateInvoicePdf(invoiceNumber);
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice_${invoiceNumber}_BZA.pdf"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
