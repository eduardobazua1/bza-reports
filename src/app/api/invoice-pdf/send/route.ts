import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { db } from "@/db";
import { invoices, documents, invoiceEmailLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email not configured" }, { status: 503 });
  }

  const { invoiceNumber, to, cc, documentIds } = await req.json();
  if (!invoiceNumber || !to) {
    return NextResponse.json({ error: "invoiceNumber and to are required" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateInvoicePdf(invoiceNumber);

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [
      { filename: `Invoice_${invoiceNumber}_BZA.pdf`, content: pdfBuffer, contentType: "application/pdf" },
    ];

    const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, invoiceNumber) });

    if (inv) {
      const allDocs = await db.select().from(documents).where(eq(documents.invoiceId, inv.id));
      const docsToAttach = documentIds !== undefined
        ? allDocs.filter(d => (documentIds as number[]).includes(d.id))
        : allDocs.filter(d => d.type === "bl" || d.type === "pl");

      for (const doc of docsToAttach) {
        const match = doc.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) continue;
        const [, mimeType, base64] = match;
        attachments.push({ filename: doc.fileName, content: Buffer.from(base64, "base64"), contentType: mimeType });
      }
    }

    const docList = attachments.slice(1).map(a => `<li>${a.filename}</li>`).join("");
    const docsHtml = docList ? `<p>Also attached:<ul>${docList}</ul></p>` : "";

    const trackingId = randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.bza-is.com";
    const pixelUrl = `${appUrl}/api/track/open?t=${trackingId}`;

    if (inv) {
      await db.insert(invoiceEmailLogs).values({
        invoiceId: inv.id,
        invoiceNumber,
        sentTo: Array.isArray(to) ? to.join(", ") : to,
        sentCc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : null,
        attachmentCount: attachments.length,
        trackingId,
      });
    }

    await sendEmail({
      to,
      ...(cc ? { cc } : {}),
      from: "accounting@bza-is.com",
      subject: `Invoice ${invoiceNumber} \u2014 BZA International Services`,
      html: `
        <p>Please find attached Invoice <strong>${invoiceNumber}</strong>.</p>
        ${docsHtml}
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <br/>
        <p>Best regards,<br/>Eduardo Bazua<br/>BZA International Services, LLC<br/>accounting@bza-is.com | www.bza-is.com</p>
        <img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />
      `,
      attachments,
    });

    return NextResponse.json({ ok: true, attachmentCount: attachments.length });
  } catch (err) {
    console.error("Invoice send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send email" }, { status: 500 });
  }
}
