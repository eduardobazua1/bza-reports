import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { supplierInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const [row] = await db
    .select({ fileUrl: supplierInvoices.fileUrl, fileName: supplierInvoices.fileName })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.id, Number(id)));

  if (!row?.fileUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // fileUrl is a data: URI — parse it back to binary
  const [header, base64] = row.fileUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${row.fileName || "document"}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
