import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { portalUsers, clients } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

const SECRET = process.env.MOBILE_JWT_SECRET || "bza-mobile-secret-2024";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const user = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.email, email.toLowerCase().trim()),
      eq(portalUsers.isActive, true),
    ),
  });

  if (!user || (user as any).password !== password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Get client info
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, user.clientId),
  });

  const token = jwt.sign(
    { userId: user.id, clientId: user.clientId, role: "client" },
    SECRET,
    { expiresIn: "30d" }
  );

  return NextResponse.json({
    token,
    name: user.name,
    email: user.email,
    clientId: user.clientId,
    clientName: client?.name || "",
    clientToken: (client as any)?.accessToken || "",
  });
}
