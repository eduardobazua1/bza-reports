"use server";

import { db } from "@/db";
import { scheduledReports, reportTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createScheduledReport(data: {
  clientId: number;
  templateId: number;
  sendDate: string;
  reminderEmail?: string;
  notes?: string;
}) {
  await db.insert(scheduledReports).values(data);
  revalidatePath("/reports/schedule");
  revalidatePath("/dashboard");
}

export async function markScheduleSent(id: number) {
  await db
    .update(scheduledReports)
    .set({ status: "sent", sentAt: new Date().toISOString() })
    .where(eq(scheduledReports.id, id));
  revalidatePath("/reports/schedule");
  revalidatePath("/dashboard");
}

export async function cancelSchedule(id: number) {
  await db
    .update(scheduledReports)
    .set({ status: "cancelled" })
    .where(eq(scheduledReports.id, id));
  revalidatePath("/reports/schedule");
  revalidatePath("/dashboard");
}

export async function createTemplate(data: {
  name: string;
  description?: string;
  format: "excel" | "portal-link";
  columns: string[];
  subject?: string;
  message?: string;
  defaultReminderEmail?: string;
}) {
  await db.insert(reportTemplates).values({
    name: data.name,
    description: data.description || null,
    format: data.format,
    columns: JSON.stringify(data.columns),
    subject: data.subject || null,
    message: data.message || null,
    defaultReminderEmail: data.defaultReminderEmail || null,
  });
  revalidatePath("/reports/schedule");
}

export async function updateTemplate(id: number, data: {
  name?: string;
  description?: string;
  columns?: string[];
  subject?: string;
  message?: string;
  defaultReminderEmail?: string;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.columns) updateData.columns = JSON.stringify(data.columns);
  if (data.subject !== undefined) updateData.subject = data.subject || null;
  if (data.message !== undefined) updateData.message = data.message || null;
  if (data.defaultReminderEmail !== undefined) updateData.defaultReminderEmail = data.defaultReminderEmail || null;

  await db.update(reportTemplates).set(updateData).where(eq(reportTemplates.id, id));
  revalidatePath("/reports/schedule");
}

export async function deleteTemplate(id: number) {
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  revalidatePath("/reports/schedule");
}
