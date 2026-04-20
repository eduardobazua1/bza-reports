import { NextRequest, NextResponse } from "next/server";
import { updateInvoice } from "@/server/actions";
import { verifyMobileToken } from "@/lib/mobile-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await updateInvoice(Number(id), body);
  return NextResponse.json({ ok: true });
}
