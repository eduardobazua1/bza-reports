import { NextRequest, NextResponse } from "next/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { buildProposalPdf } from "../route";
import { getProposal } from "@/server/queries";
import { updateProposalStatus } from "@/server/actions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email not configured. Add SMTP credentials to .env.local" }, { status: 503 });
  }

  const { proposalId, to, cc, subject, message } = await req.json() as {
    proposalId: number;
    to: string;
    cc?: string;
    subject?: string;
    message?: string;
  };

  if (!proposalId || !to) {
    return NextResponse.json({ error: "proposalId and to are required" }, { status: 400 });
  }

  try {
    const proposal = await getProposal(proposalId);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const pdfBytes = await buildProposalPdf(proposalId);
    const fileName = `Proposal_${proposal.proposalNumber}_BZA.pdf`;

    const clientName = proposal.client?.name || "Valued Client";
    const emailSubject = subject || `Proposal ${proposal.proposalNumber} — BZA International Services`;
    const emailBody = message
      ? `<p>${message.replace(/\n/g, "<br>")}</p>`
      : `<p>Dear ${clientName},</p>
         <p>Please find attached our proposal <strong>${proposal.proposalNumber}</strong> for your review.</p>
         <p>We look forward to your feedback.</p>
         <br>
         <p>Best regards,<br><strong>BZA International Services, LLC</strong><br>accounting@bza-is.com</p>`;

    await sendEmail({
      to,
      cc: cc || undefined,
      subject: emailSubject,
      html: emailBody,
      attachments: [
        { filename: fileName, content: Buffer.from(pdfBytes), contentType: "application/pdf" },
      ],
    });

    // Mark proposal as sent
    await updateProposalStatus(proposalId, "sent");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
