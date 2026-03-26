import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import bcrypt from "bcryptjs";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "sqlite.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log("Seeding database...");

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  db.insert(schema.users)
    .values({
      email: "eduardo@bza.com",
      name: "Eduardo Bazua",
      passwordHash,
      role: "admin",
    })
    .onConflictDoNothing()
    .run();

  console.log("Admin user created: eduardo@bza.com / admin123");
  console.log("Seed complete!");
}

seed().catch(console.error);
