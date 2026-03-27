import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, Number(id)),
  });

  if (!doc || !doc.fileUrl) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Parse base64 data URL
  const match = doc.fileUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    // If it's a regular URL (from old blob storage), redirect
    return NextResponse.redirect(doc.fileUrl);
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
