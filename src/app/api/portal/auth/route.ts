import { db } from "@/db";
import { portalUsers, portalCodes, clients } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// POST /api/portal/auth
// body: { action: "send-code", email, token } or { action: "verify", email, code, token }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, email, token } = body;

  if (!email || !token) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Find client by token
  const client = await db.query.clients.findFirst({
    where: eq(clients.accessToken, token),
  });
  if (!client || !client.portalEnabled) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Find portal user by email + client
  const portalUser = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.clientId, client.id),
      eq(portalUsers.email, email.toLowerCase().trim()),
      eq(portalUsers.isActive, true),
    ),
  });

  if (!portalUser) {
    // Don't reveal if email exists or not
    return NextResponse.json({ error: "If this email is authorized, you will receive a code." }, { status: 200 });
  }

  if (action === "send-code") {
    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    await db.insert(portalCodes).values({
      portalUserId: portalUser.id,
      code,
      expiresAt,
    });

    // Send email
    try {
      await transporter.sendMail({
        from: `"BZA International" <${process.env.SMTP_FROM}>`,
        to: portalUser.email,
        subject: "Your BZA Portal Access Code",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
            <img src="https://app.bza-is.com/bza-logo-new.png" alt="BZA" style="height: 40px; margin-bottom: 24px;" />
            <h2 style="color: #1c1917; margin-bottom: 8px;">Hello, ${portalUser.name}!</h2>
            <p style="color: #78716c; font-size: 14px; margin-bottom: 24px;">Use this code to access your shipment portal:</p>
            <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1c1917;">${code}</span>
            </div>
            <p style="color: #a8a29e; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
            <p style="color: #d6d3d1; font-size: 11px;">BZA International Services, LLC · McAllen, TX</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Email send error:", e);
      return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
    }

    return NextResponse.json({ sent: true, name: portalUser.name });

  } else if (action === "verify") {
    const { code } = body;
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    // Find valid code
    const validCode = await db.query.portalCodes.findFirst({
      where: and(
        eq(portalCodes.portalUserId, portalUser.id),
        eq(portalCodes.code, code),
        eq(portalCodes.used, false),
      ),
      orderBy: [desc(portalCodes.createdAt)],
    });

    if (!validCode || new Date(validCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    // Mark code as used
    await db.update(portalCodes).set({ used: true }).where(eq(portalCodes.id, validCode.id));

    // Update last login
    await db.update(portalUsers).set({ lastLogin: new Date().toISOString() }).where(eq(portalUsers.id, portalUser.id));

    // Return session data — the client stores this in a cookie
    const sessionData = {
      verified: true,
      userId: portalUser.id,
      name: portalUser.name,
      email: portalUser.email,
      clientId: client.id,
      clientName: client.name,
      token,
    };

    const res = NextResponse.json(sessionData);
    // Set portal session cookie (30 days)
    res.cookies.set("portal-session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
