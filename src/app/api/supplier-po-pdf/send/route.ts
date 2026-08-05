import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { generateSupplierPoPdf } from "@/lib/pdf-supplier-po";
import { db } from "@/db";
import { supplierOrderSends } from "@/db/schema";

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const { poId, soId, to, poNumber, note } = await req.json();
  if (!poId || !soId || !to) {
    return NextResponse.json({ error: "poId, soId, and to are required" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateSupplierPoPdf(Number(poId), Number(soId));
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

    // Log this send for history / tracking (persists, enables re-send)
    const [logRow] = await db.insert(supplierOrderSends).values({
      supplierOrderId: Number(soId),
      purchaseOrderId: Number(poId),
      sentTo: to,
      note: note || null,
    }).returning();

    return NextResponse.json({ ok: true, sentAt: logRow.sentAt, sentTo: logRow.sentTo });
  } catch (err) {
    console.error("Supplier PO send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send email" }, { status: 500 });
  }
}
