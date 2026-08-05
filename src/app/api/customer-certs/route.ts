import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customerCertificates, clients } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET            → Customer Certification Master (metadata, no file bytes)
// GET ?id=X&file → stream the attached certificate PDF
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id && req.nextUrl.searchParams.get("file") != null) {
    const [row] = await db.select().from(customerCertificates).where(eq(customerCertificates.id, Number(id)));
    if (!row?.fileUrl) return NextResponse.json({ error: "No file" }, { status: 404 });
    const m = row.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Bad file" }, { status: 500 });
    return new NextResponse(new Uint8Array(Buffer.from(m[2], "base64")), {
      headers: { "Content-Type": m[1], "Content-Disposition": `inline; filename="${row.fileName || "certificate.pdf"}"` },
    });
  }
  const rows = await db
    .select({
      id: customerCertificates.id, clientId: customerCertificates.clientId, clientName: clients.name,
      scheme: customerCertificates.scheme, certificateNumber: customerCertificates.certificateNumber,
      certifier: customerCertificates.certifier, issueDate: customerCertificates.issueDate,
      expiryDate: customerCertificates.expiryDate, status: customerCertificates.status,
      verificationSource: customerCertificates.verificationSource, lastVerifiedAt: customerCertificates.lastVerifiedAt,
      fileName: customerCertificates.fileName,
    })
    .from(customerCertificates)
    .leftJoin(clients, eq(customerCertificates.clientId, clients.id))
    .orderBy(clients.name, customerCertificates.scheme);
  return NextResponse.json(rows);
}

// PUT → upsert a customer certificate row (auto-save from the UI).
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const now = new Date().toISOString().split("T")[0];
  const values = {
    certificateNumber: b.certificateNumber ?? null,
    certifier: b.certifier ?? null,
    issueDate: b.issueDate ?? null,
    expiryDate: b.expiryDate ?? null,
    status: (b.status as string) || "pending",
    verificationSource: b.verificationSource || "Manual entry",
    lastVerifiedAt: now,
  };
  if (b.id) {
    await db.update(customerCertificates).set(values).where(eq(customerCertificates.id, Number(b.id)));
    return NextResponse.json({ ok: true, id: b.id });
  }
  if (!b.clientId || !b.scheme) return NextResponse.json({ error: "clientId and scheme required" }, { status: 400 });
  const [row] = await db.insert(customerCertificates).values({ clientId: Number(b.clientId), scheme: String(b.scheme), ...values }).returning({ id: customerCertificates.id });
  return NextResponse.json({ ok: true, id: row.id });
}

// POST FormData { id, file } → attach a certificate PDF.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = form.get("id") as string;
  const file = form.get("file") as File | null;
  if (!id || !file) return NextResponse.json({ error: "id and file required" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too large" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const fileUrl = `data:${file.type || "application/pdf"};base64,${buf.toString("base64")}`;
  await db.update(customerCertificates).set({ fileName: file.name, fileUrl }).where(eq(customerCertificates.id, Number(id)));
  return NextResponse.json({ ok: true });
}
