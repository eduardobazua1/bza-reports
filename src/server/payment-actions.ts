"use server";

import { db } from "@/db";
import { supplierPayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity, diffRecords } from "./activity";

export async function createSupplierPayment(data: {
  supplierId: number;
  purchaseOrderId?: number;
  invoiceId?: number;
  amountUsd: number;
  paymentDate: string;
  estimatedTons?: number;
  pricePerTon?: number;
  tons?: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}) {
  const [row] = await db.insert(supplierPayments).values(data).returning({ id: supplierPayments.id });
  await logActivity({ action: "pay", entity: "supplier_payment", entityId: row?.id, entityLabel: data.reference || `$${data.amountUsd}`, changes: diffRecords(null, data) });
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}

export async function updateSupplierPayment(id: number, data: {
  actualTons?: number;
  actualAmount?: number;
  adjustmentAmount?: number;
  adjustmentStatus?: "pending" | "settled" | "na";
}) {
  const before = await db.query.supplierPayments.findFirst({ where: eq(supplierPayments.id, id) });
  await db.update(supplierPayments).set(data).where(eq(supplierPayments.id, id));
  await logActivity({ action: "update", entity: "supplier_payment", entityId: id, entityLabel: before?.reference || `$${before?.amountUsd ?? ""}`, changes: diffRecords(before, data) });
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}

export async function deleteSupplierPayment(id: number) {
  const before = await db.query.supplierPayments.findFirst({ where: eq(supplierPayments.id, id) });
  await db.delete(supplierPayments).where(eq(supplierPayments.id, id));
  await logActivity({ action: "delete", entity: "supplier_payment", entityId: id, entityLabel: before?.reference || `$${before?.amountUsd ?? ""}` });
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}
