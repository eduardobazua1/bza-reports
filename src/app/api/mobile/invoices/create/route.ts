import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, purchaseOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  if (!verifyMobileToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    purchaseOrderId, invoiceNumber, quantityTons, shipmentDate,
    destination, vehicleId, blNumber, sellPriceOverride,
    shipmentStatus, notes,
  } = body;

  if (!purchaseOrderId || !invoiceNumber || !quantityTons) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify PO exists
  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, purchaseOrderId) });
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const [inv] = await db.insert(invoices).values({
    purchaseOrderId,
    invoiceNumber,
    quantityTons: Number(quantityTons),
    shipmentDate: shipmentDate || null,
    destination: destination || null,
    vehicleId: vehicleId || null,
    blNumber: blNumber || null,
    sellPriceOverride: sellPriceOverride ? Number(sellPriceOverride) : null,
    shipmentStatus: shipmentStatus || "programado",
    notes: notes || null,
    customerPaymentStatus: "unpaid",
    supplierPaymentStatus: "unpaid",
  }).returning();

  revalidatePath("/invoices");
  revalidatePath("/shipments");
  return NextResponse.json({ id: inv.id, invoiceNumber: inv.invoiceNumber });
}
