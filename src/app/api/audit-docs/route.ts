import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET            → list metadata (no file bytes)
// GET ?id=X&dl=1 → download that file
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const [doc] = await db.select().from(auditDocuments).where(eq(auditDocuments.id, Number(id)));
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const m = doc.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Bad file" }, { status: 500 });
    const buf = Buffer.from(m[2], "base64");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": m[1],
        "Content-Disposition": `attachment; filename="${doc.fileName}"`,
      },
    });
  }
  const rows = await db
    .select({
      id: auditDocuments.id, itemKey: auditDocuments.itemKey, cert: auditDocuments.cert,
      title: auditDocuments.title, fileName: auditDocuments.fileName,
      fileSize: auditDocuments.fileSize, uploadedAt: auditDocuments.uploadedAt,
    })
    .from(auditDocuments)
    .orderBy(auditDocuments.itemKey, auditDocuments.uploadedAt);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const itemKey = form.get("itemKey") as string;
  const cert = (form.get("cert") as string) || null;
  const title = (form.get("title") as string) || null;

  if (!file || !itemKey) return NextResponse.json({ error: "file and itemKey required" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const fileUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  const [row] = await db.insert(auditDocuments).values({
    itemKey, cert, title, fileName: file.name, fileUrl, fileSize: file.size,
  }).returning({ id: auditDocuments.id });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(auditDocuments).where(eq(auditDocuments.id, Number(id)));
  return NextResponse.json({ ok: true });
}
