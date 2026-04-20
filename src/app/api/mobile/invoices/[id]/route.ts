import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(invoices).where(eq(invoices.id, Number(id)));

  revalidatePath("/invoices");
  return NextResponse.json({ ok: true });
}
