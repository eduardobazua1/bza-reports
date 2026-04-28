import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { buildGenericPdf } from "@/app/api/reports/pdf/route";

export const dynamic = "force-dynamic";

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured. Add SMTP_USER and SMTP_PASS to .env.local." },
      { status: 400 },
    );
  }

  let body: {
    title?: string;
    subtitle?: string;
    dateLabel?: string;
    columns?: { key: string; label: string; align?: string; format?: string }[];
    rows?: Record<string, unknown>[];
    totals?: Record<string, unknown>;
    totalsLabel?: string;
    to: string;
    subject?: string;
    message?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { to, subject, message, title = "Report", ...pdfPayload } = body;

  if (!to || !to.trim()) {
    return NextResponse.json({ error: "Missing recipient email address." }, { status: 400 });
  }

  try {
    // Generate the PDF
    const pdfBytes = await buildGenericPdf({
      title,
      subtitle: pdfPayload.subtitle,
      dateLabel: pdfPayload.dateLabel,
      columns: (pdfPayload.columns ?? []) as {
        key: string;
        label: string;
        align?: "left" | "right" | "center";
        format?: "text" | "currency" | "date" | "number" | "percent" | "status";
      }[],
      rows: pdfPayload.rows ?? [],
      totals: pdfPayload.totals,
      totalsLabel: pdfPayload.totalsLabel,
    });

    const safeTitle = title.replace(/[^a-zA-Z0-9_\- ]/g, "_");
    const pdfBuffer = Buffer.from(pdfBytes);

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const rowCount = (pdfPayload.rows ?? []).length;

    await sendEmail({
      to: to.trim(),
      subject: (subject?.trim()) || title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="border-bottom: 2px solid #e7e5e4; padding-bottom: 16px; margin-bottom: 24px;">
            <p style="font-size: 12px; color: #78716c; margin: 0 0 4px 0;">BZA International Services</p>
            <h2 style="font-size: 20px; color: #1c1917; margin: 0;">${title}</h2>
            ${pdfPayload.dateLabel ? `<p style="font-size: 12px; color: #78716c; margin: 4px 0 0 0;">${pdfPayload.dateLabel}</p>` : ""}
          </div>

          ${message
            ? `<p style="font-size: 14px; line-height: 1.6; color: #44403c; margin-bottom: 20px;">${message.replace(/\n/g, "<br>")}</p>`
            : ""
          }

          <p style="font-size: 13px; color: #57534e; margin-bottom: 24px;">
            Please find the attached PDF report — <strong>${rowCount.toLocaleString()} row${rowCount !== 1 ? "s" : ""}</strong> as of ${dateStr}.
          </p>

          <div style="border-top: 1px solid #e7e5e4; padding-top: 16px; margin-top: 32px;">
            <p style="font-size: 11px; color: #a8a29e; margin: 0;">
              BZA International Services, LLC<br>
              1209 S. 10th St. Suite A #583, McAllen, TX 78501<br>
              ebazua@bza-is.com
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${safeTitle}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send report: ${msg}` }, { status: 500 });
  }
}
