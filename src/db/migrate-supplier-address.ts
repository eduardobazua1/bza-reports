import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // Add address column
  await client.execute("ALTER TABLE suppliers ADD COLUMN address TEXT").catch(() => {});

  // Get supplier IDs
  const res = await client.execute("SELECT id, name FROM suppliers");
  console.log("Suppliers:", JSON.stringify(res.rows));

  for (const row of res.rows) {
    const name = row[1] as string;
    let address: string | null = null;

    if (name.toLowerCase().includes("cascade")) {
      address = "30480 American Drive\nHalsey, Oregon 97348\nUnited States";
    } else if (name.toLowerCase().includes("arauco")) {
      address = "Av. El Golf 150, piso 14\nLas Condes - R.M.\nSantiago, Chile";
    }

    if (address) {
      await client.execute({
        sql: "UPDATE suppliers SET address = ? WHERE id = ?",
        args: [address, row[0] as number],
      });
      console.log(`Updated ${name}`);
    }
  }

  console.log("Done");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
