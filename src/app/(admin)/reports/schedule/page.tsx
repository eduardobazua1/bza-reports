import { db } from "@/db";
import { reportTemplates, scheduledReports, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { ScheduleActions } from "@/components/schedule-actions";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const templates = await db.select().from(reportTemplates).orderBy(reportTemplates.name);
  const allClients = await db.select().from(clients).orderBy(clients.name);

  const schedules = await db
    .select({
      schedule: scheduledReports,
      clientName: clients.name,
      clientEmail: clients.contactEmail,
      templateName: reportTemplates.name,
      templateFormat: reportTemplates.format,
    })
    .from(scheduledReports)
    .leftJoin(clients, eq(scheduledReports.clientId, clients.id))
    .leftJoin(reportTemplates, eq(scheduledReports.templateId, reportTemplates.id))
    .orderBy(desc(scheduledReports.sendDate));

  const today = new Date().toISOString().split("T")[0];
  const pending = schedules.filter((s) => s.schedule.status === "pending");
  const overdue = pending.filter((s) => s.schedule.sendDate <= today);
  const upcoming = pending.filter((s) => s.schedule.sendDate > today);
  const sent = schedules.filter((s) => s.schedule.status === "sent");

  return (
    <div className="space-y-6">
      <ScheduleActions
        templates={templates}
        clients={allClients}
        overdue={overdue.map((s) => ({
          id: s.schedule.id,
          clientName: s.clientName || "",
          clientEmail: s.clientEmail || "",
          templateName: s.templateName || "",
          templateFormat: s.schedule.status,
          sendDate: s.schedule.sendDate,
          notes: s.schedule.notes,
          clientId: s.schedule.clientId,
          templateId: s.schedule.templateId,
        }))}
        upcoming={upcoming.map((s) => ({
          id: s.schedule.id,
          clientName: s.clientName || "",
          templateName: s.templateName || "",
          sendDate: s.schedule.sendDate,
          notes: s.schedule.notes,
        }))}
        sent={sent.slice(0, 20).map((s) => ({
          id: s.schedule.id,
          clientName: s.clientName || "",
          templateName: s.templateName || "",
          sendDate: s.schedule.sendDate,
          sentAt: s.schedule.sentAt,
        }))}
      />
    </div>
  );
}
