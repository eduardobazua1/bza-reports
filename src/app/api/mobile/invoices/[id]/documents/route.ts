import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const docs = await db.select({ id: documents.id, type: documents.type, fileName: documents.fileName })
    .from(documents)
    .where(eq(documents.invoiceId, Number(id)));

  return NextResponse.json(docs);
}
