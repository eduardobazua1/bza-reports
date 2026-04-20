import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { db } from "@/db";
import { invoices, documents, invoiceEmailLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isEmailConfigured()) return NextResponse.json({ error: "Email not configured" }, { status: 503 });

  const { invoiceId, to, cc } = await req.json();
  if (!invoiceId || !to) return NextResponse.json({ error: "invoiceId and to are required" }, { status: 400 });

  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, Number(invoiceId)) });
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  try {
    const invoiceNumber = inv.billingDocument || inv.invoiceNumber;
    const pdfBuffer = await generateInvoicePdf(invoiceNumber);

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [
      { filename: `Invoice_${invoiceNumber}_BZA.pdf`, content: pdfBuffer, contentType: "application/pdf" },
    ];

    // Attach BL and PL documents
    const allDocs = await db.select().from(documents).where(eq(documents.invoiceId, inv.id));
    const docsToAttach = allDocs.filter(d => d.type === "bl" || d.type === "pl");
    for (const doc of docsToAttach) {
      const match = doc.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) continue;
      const [, mimeType, base64] = match;
      attachments.push({ filename: doc.fileName, content: Buffer.from(base64, "base64"), contentType: mimeType });
    }

    const docList = attachments.slice(1).map(a => `<li>${a.filename}</li>`).join("");
    const docsHtml = docList ? `<p>Also attached:<ul>${docList}</ul></p>` : "";
    const trackingId = randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bza-reports.vercel.app";

    await db.insert(invoiceEmailLogs).values({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      sentTo: Array.isArray(to) ? to.join(", ") : to,
      sentCc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : null,
      attachmentCount: attachments.length,
      trackingId,
    });

    await sendEmail({
      to,
      ...(cc ? { cc } : {}),
      from: "accounting@bza-is.com",
      subject: `Invoice ${invoiceNumber} — BZA International Services`,
      html: `
        <p>Please find attached Invoice <strong>${invoiceNumber}</strong>.</p>
        ${docsHtml}
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <br/>
        <p>Best regards,<br/>Eduardo Bazua<br/>BZA International Services, LLC<br/>accounting@bza-is.com | www.bza-is.com</p>
        <img src="${appUrl}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none" alt="" />
      `,
      attachments,
    });

    return NextResponse.json({ ok: true, attachmentCount: attachments.length });
  } catch (err) {
    console.error("Mobile invoice send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send" }, { status: 500 });
  }
}
