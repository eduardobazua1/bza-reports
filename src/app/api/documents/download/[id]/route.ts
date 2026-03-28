import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, parseInt(id)),
  });

  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  // If fileUrl is a data URI (base64), convert to binary and serve
  if (doc.fileUrl.startsWith("data:")) {
    const match = doc.fileUrl.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64 = match[2];
      const buffer = Buffer.from(base64, "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `inline; filename="${doc.fileName}"`,
          "Content-Length": buffer.length.toString(),
        },
      });
    }
  }

  // If it's a regular URL, redirect
  return NextResponse.redirect(doc.fileUrl);
}
