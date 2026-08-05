export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { activityLog, users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ActivityLogView } from "@/components/activity-log-view";

export default async function ActivityPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "admin") redirect("/dashboard");

  const [rows, allUsers] = await Promise.all([
    db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(1000),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users),
  ]);

  return <ActivityLogView rows={rows} users={allUsers} />;
}
