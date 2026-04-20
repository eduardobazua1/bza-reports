import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { signMobileToken } from "@/lib/mobile-auth";

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const result = await turso.execute({
      sql: "SELECT id, client_id, name, password FROM portal_users WHERE email = ? AND is_active = 1 LIMIT 1",
      args: [email.toLowerCase().trim()],
    });

    const user = result.rows[0];

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const clientResult = await turso.execute({
      sql: "SELECT name, access_token FROM clients WHERE id = ? LIMIT 1",
      args: [user.client_id],
    });
    const clientRow = clientResult.rows[0];
    const clientName = clientRow?.name || "";
    const clientToken = clientRow?.access_token || "";

    const token = signMobileToken(Number(user.id), email.toLowerCase().trim());

    return NextResponse.json({
      token,
      name: user.name,
      email: email.toLowerCase().trim(),
      clientId: user.client_id,
      clientName,
      clientToken,
    });
  } catch (err) {
    console.error("client-auth error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
