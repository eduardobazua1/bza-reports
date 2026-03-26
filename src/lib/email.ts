import nodemailer from "nodemailer";

// IONOS SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ionos.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bza.com";

  return transporter.sendMail({
    from: `"BZA International Services" <${from}>`,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
    attachments,
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
