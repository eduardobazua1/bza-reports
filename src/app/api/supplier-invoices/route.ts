import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { supplierInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const poId = req.nextUrl.searchParams.get("poId");
  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  const rows = await db
    .select({
      id: supplierInvoices.id,
      purchaseOrderId: supplierInvoices.purchaseOrderId,
      supplierId: supplierInvoices.supplierId,
      invoiceNumber: supplierInvoices.invoiceNumber,
      invoiceDate: supplierInvoices.invoiceDate,
      estimatedTons: supplierInvoices.estimatedTons,
      amountUsd: supplierInvoices.amountUsd,
      notes: supplierInvoices.notes,
      fileName: supplierInvoices.fileName,
      fileSize: supplierInvoices.fileSize,
      paymentStatus: supplierInvoices.paymentStatus,
      createdAt: supplierInvoices.createdAt,
    })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.purchaseOrderId, Number(poId)))
    .orderBy(supplierInvoices.invoiceDate);

  // Return download URL instead of raw base64
  return NextResponse.json(
    rows.map(r => ({
      ...r,
      fileUrl: r.fileName ? `/api/supplier-invoices/file?id=${r.id}` : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const purchaseOrderId = Number(formData.get("purchaseOrderId"));
  const supplierId = Number(formData.get("supplierId"));
  const invoiceNumber = formData.get("invoiceNumber") as string;
  const invoiceDate = (formData.get("invoiceDate") as string) || null;
  const estimatedTons = formData.get("estimatedTons") ? Number(formData.get("estimatedTons")) : null;
  const amountUsd = formData.get("amountUsd") ? Number(formData.get("amountUsd")) : null;
  const notes = (formData.get("notes") as string) || null;
  const file = formData.get("file") as File | null;

  if (!purchaseOrderId || !supplierId || !invoiceNumber) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  const [row] = await db
    .insert(supplierInvoices)
    .values({ purchaseOrderId, supplierId, invoiceNumber, invoiceDate, estimatedTons, amountUsd, notes, fileName, fileUrl, fileSize })
    .returning();

  return NextResponse.json({ ...row, fileUrl: row.fileName ? `/api/supplier-invoices/file?id=${row.id}` : null });
}
