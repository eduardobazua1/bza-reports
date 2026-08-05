import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditDocuments } from "@/db/schema";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { buildSalesAgingReport } from "@/lib/sales-aging-report";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST { to, cc?, subject?, message?, includeReport? }
// Sends every stored audit document (+ the Sales Aging Report) as attachments in one email.
export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email is not configured (SMTP_USER / SMTP_PASS missing)." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const to: string = (body.to || "").trim();
  const cc: string = (body.cc || "").trim();
  const subject: string = (body.subject || "").trim() || "BZA International Services — FSC/PEFC Chain of Custody documentation";
  const message: string = (body.message || "").trim();
  const includeReport: boolean = body.includeReport !== false; // default true

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  const ccList = cc ? cc.split(",").map((s: string) => s.trim()).filter((s: string) => EMAIL_RE.test(s)) : [];

  // Gather stored documents as attachments. If body.docIds is provided, only send those.
  const selectedIds: number[] | null = Array.isArray(body.docIds) ? body.docIds.map(Number) : null;
  const docs = (await db.select().from(auditDocuments).orderBy(auditDocuments.itemKey))
    .filter((d) => (selectedIds ? selectedIds.includes(d.id) : true));
  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
  for (const d of docs) {
    const m = d.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) continue;
    attachments.push({ filename: d.fileName, content: Buffer.from(m[2], "base64"), contentType: m[1] });
  }

  // Generate the Sales Aging Report (all years) and attach it too.
  if (includeReport) {
    try {
      const { buffer, filename } = await buildSalesAgingReport();
      attachments.push({
        filename,
        content: buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch {
      /* if the report fails, still send the documents */
    }
  }

  if (attachments.length === 0) {
    return NextResponse.json({ error: "No documents available to send." }, { status: 400 });
  }

  const fileList = attachments.map((a) => `<li>${a.filename}</li>`).join("");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c1917;font-size:14px;line-height:1.5">
      <p>Dear Control Union,</p>
      ${message ? `<p>${message.replace(/\n/g, "<br>")}</p>` : "<p>Please find attached BZA International Services' FSC and PEFC Chain of Custody documentation for the audit.</p>"}
      <p style="margin-top:16px"><strong>Attached documents (${attachments.length}):</strong></p>
      <ul>${fileList}</ul>
      <p style="margin-top:16px">Best regards,<br>J. Eduardo Bazúa Ordaz<br>BZA International Services, LLC<br>FSC License FSC-C005174 · PEFC CU-PEFC-COC-903182</p>
    </div>`;

  try {
    const info = await sendEmail({ to, cc: ccList.length ? ccList : undefined, subject, html, attachments });
    return NextResponse.json({ ok: true, sent: attachments.length, messageId: (info as { messageId?: string })?.messageId ?? null });
  } catch (e) {
    return NextResponse.json({ error: `Send failed: ${(e as Error).message}` }, { status: 500 });
  }
}
