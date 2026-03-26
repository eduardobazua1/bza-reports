"use server";

import { db } from "@/db";
import { supplierPayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
  await db.insert(supplierPayments).values(data);
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}

export async function updateSupplierPayment(id: number, data: {
  actualTons?: number;
  actualAmount?: number;
  adjustmentAmount?: number;
  adjustmentStatus?: "pending" | "settled" | "na";
}) {
  await db.update(supplierPayments).set(data).where(eq(supplierPayments.id, id));
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}

export async function deleteSupplierPayment(id: number) {
  await db.delete(supplierPayments).where(eq(supplierPayments.id, id));
  revalidatePath("/suppliers");
  revalidatePath("/dashboard");
}
