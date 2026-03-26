"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

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
  await db.insert(users).values({
    email: data.email,
    name: data.name,
    passwordHash,
    role: data.role,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUser(id: number, data: {
  role?: "admin" | "viewer";
  isActive?: boolean;
}) {
  await db.update(users).set(data).where(eq(users.id, id));
  revalidatePath("/settings");
}

export async function resetPassword(id: number, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  revalidatePath("/settings");
}
