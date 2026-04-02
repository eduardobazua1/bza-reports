import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "invoice";
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  if (!row) return NextResponse.json(null);
  try { return NextResponse.json(JSON.parse(row.value)); } catch { return NextResponse.json(null); }
}

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "invoice";
  const body = await req.json();
  const value = JSON.stringify(body);
  const now = new Date().toISOString();

  // Upsert
  const existing = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  if (existing) {
    await db.update(appSettings).set({ value, updatedAt: now }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value, updatedAt: now });
  }
  return NextResponse.json({ ok: true });
}
