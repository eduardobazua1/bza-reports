"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { logActivity, diffRecords } from "./activity";

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: "admin" | "viewer";
}) {
  // Check if email already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });
  if (existing) {
    return { error: "User with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const [row] = await db.insert(users).values({
    email: data.email,
    name: data.name,
    passwordHash,
    role: data.role,
  }).returning({ id: users.id });
  await logActivity({
    action: "create", entity: "user", entityId: row?.id, entityLabel: data.email,
    changes: [{ field: "name", before: null, after: data.name }, { field: "role", before: null, after: data.role }],
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUser(id: number, data: {
  role?: "admin" | "viewer";
  isActive?: boolean;
}) {
  const before = await db.query.users.findFirst({ where: eq(users.id, id) });
  await db.update(users).set(data).where(eq(users.id, id));
  await logActivity({ action: "update", entity: "user", entityId: id, entityLabel: before?.email, changes: diffRecords(before, data) });
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetPassword(id: number, newPassword: string) {
  const before = await db.query.users.findFirst({ where: eq(users.id, id) });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  await logActivity({ action: "update", entity: "user", entityId: id, entityLabel: before?.email, changes: [{ field: "password", before: "•••", after: "•••" }] });
  revalidatePath("/settings");
  return { ok: true };
}
