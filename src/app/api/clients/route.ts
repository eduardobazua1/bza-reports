import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const list = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .orderBy(asc(clients.name));
  return NextResponse.json(list);
}
