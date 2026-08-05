import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id: certificates.id,
      name: certificates.name,
      certType: certificates.certType,
      certCode: certificates.certCode,
      issuedBy: certificates.issuedBy,
      issuedTo: certificates.issuedTo,
      validFrom: certificates.validFrom,
      validUntil: certificates.validUntil,
      standard: certificates.standard,
      notes: certificates.notes,
      fileName: certificates.fileName,
      fileSize: certificates.fileSize,
      createdAt: certificates.createdAt,
    })
    .from(certificates)
    .orderBy(desc(certificates.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  const name      = formData.get("name") as string;
  const certType  = formData.get("certType") as string;
  const certCode  = formData.get("certCode") as string | null;
  const issuedBy  = formData.get("issuedBy") as string | null;
  const issuedTo  = formData.get("issuedTo") as string | null;
  const validFrom = formData.get("validFrom") as string | null;
  const validUntil = formData.get("validUntil") as string | null;
  const standard  = formData.get("standard") as string | null;
  const notes     = formData.get("notes") as string | null;

  if (!name || !certType) {
    return NextResponse.json({ error: "name and certType are required" }, { status: 400 });
  }

  let fileName: string | null = null;
  let fileUrl: string | null = null;
  let fileSize: number | null = null;

  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/pdf";
    fileUrl = `data:${mimeType};base64,${base64}`;
    fileName = file.name;
    fileSize = file.size;
  }

  const [row] = await db.insert(certificates).values({
    name,
    certType,
    certCode: certCode || null,
    issuedBy: issuedBy || null,
    issuedTo: issuedTo || null,
    validFrom: validFrom || null,
    validUntil: validUntil || null,
    standard: standard || null,
    notes: notes || null,
    fileName,
    fileUrl,
    fileSize,
  }).returning({ id: certificates.id });

  return NextResponse.json({ ok: true, id: row.id });
}
