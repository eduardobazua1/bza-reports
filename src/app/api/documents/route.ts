import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

// Upload a document
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const invoiceId = Number(formData.get("invoiceId"));
  const docType = formData.get("type") as "invoice" | "bl" | "pl" | "other";

  if (!file || !invoiceId || !docType) {
    return NextResponse.json({ error: "Missing file, invoiceId or type" }, { status: 400 });
  }

  try {
    // Upload to Vercel Blob
    const blob = await put(`documents/${invoiceId}/${docType}-${file.name}`, file, {
      access: "public",
    });

    // Save to database
    await db.insert(documents).values({
      invoiceId,
      type: docType,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
    });

    return NextResponse.json({ ok: true, url: blob.url, fileName: file.name });
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
    .select()
    .from(documents)
    .where(eq(documents.invoiceId, Number(invoiceId)))
    .orderBy(documents.type);

  return NextResponse.json(docs);
}

// Delete a document
export async function DELETE(req: NextRequest) {
  const { id, fileUrl } = await req.json();

  try {
    // Delete from Vercel Blob
    if (fileUrl) {
      await del(fileUrl);
    }
    // Delete from database
    await db.delete(documents).where(eq(documents.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
