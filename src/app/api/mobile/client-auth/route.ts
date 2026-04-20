import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const SECRET = process.env.MOBILE_JWT_SECRET || "bza-mobile-secret-2024";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Use raw SQL to include the password column (not in Drizzle schema)
  const rows = await db.execute(
    sql`SELECT id, client_id, email, name, is_active, password FROM portal_users WHERE email = ${email.toLowerCase().trim()} AND is_active = 1 LIMIT 1`
  );

  const user = rows.rows[0] as { id: number; client_id: number; email: string; name: string; is_active: number; password: string | null } | undefined;

  if (!user || user.password !== password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, user.client_id),
  });

  const token = jwt.sign(
    { userId: user.id, clientId: user.client_id, role: "client" },
    SECRET,
    { expiresIn: "30d" }
  );

  return NextResponse.json({
    token,
    name: user.name,
    email: user.email,
    clientId: user.client_id,
    clientName: (client as any)?.name || "",
    clientToken: (client as any)?.accessToken || "",
  });
}
