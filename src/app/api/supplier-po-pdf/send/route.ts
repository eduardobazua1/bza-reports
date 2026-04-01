import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const { poId, soId, to, poNumber } = await req.json();
  if (!poId || !soId || !to) {
    return NextResponse.json({ error: "poId, soId, and to are required" }, { status: 400 });
  }

  // Generate the PDF by calling our own endpoint
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const pdfRes = await fetch(`${baseUrl}/api/supplier-po-pdf?poId=${poId}&soId=${soId}`);
  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const fileName = `SupplierPO_${poNumber || poId}_BZA.pdf`;

  await sendEmail({
    to,
    subject: `Purchase Order ${poNumber || poId} — BZA International Services`,
    html: `
      <p>Please find attached our Purchase Order <strong>${poNumber || poId}</strong>.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <br/>
      <p>Best regards,<br/>Eduardo Bazua<br/>BZA International Services, LLC<br/>ebazua@bza-is.com | www.bza-is.com</p>
    `,
    attachments: [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }],
  });

  return NextResponse.json({ ok: true });
}
