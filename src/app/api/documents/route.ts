import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

// Upload a document — store as base64 in database (no external storage needed)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const invoiceId = Number(formData.get("invoiceId"));
  const docType = formData.get("type") as "invoice" | "bl" | "pl" | "other";

  if (!file || !invoiceId || !docType) {
    return NextResponse.json({ error: "Missing file, invoiceId or type" }, { status: 400 });
  }

  // Limit file size to 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });
  }

  try {
    // Convert file to base64 data URL
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/pdf";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Save to database
    await db.insert(documents).values({
      invoiceId,
      type: docType,
      fileName: file.name,
      fileUrl: dataUrl,
      fileSize: file.size,
    });

    return NextResponse.json({ ok: true, fileName: file.name });
  } catch (error) {
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// Get documents for an invoice
export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoiceId");
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  const docs = await db
    .select({
      id: documents.id,
      invoiceId: documents.invoiceId,
      type: documents.type,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      uploadedAt: documents.uploadedAt,
      // Don't send base64 data in list — only metadata
      hasFile: documents.fileUrl,
    })
    .from(documents)
    .where(eq(documents.invoiceId, Number(invoiceId)))
    .orderBy(documents.type);

  // Map to hide base64 data, just indicate file exists
  const result = docs.map(d => ({
    id: d.id,
    invoiceId: d.invoiceId,
    type: d.type,
    fileName: d.fileName,
    fileSize: d.fileSize,
    uploadedAt: d.uploadedAt,
    fileUrl: `/api/documents/download?id=${d.id}`,
  }));

  return NextResponse.json(result);
}

// Delete a document
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  try {
    await db.delete(documents).where(eq(documents.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
