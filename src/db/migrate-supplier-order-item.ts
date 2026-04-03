import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  await client.execute("ALTER TABLE supplier_orders ADD COLUMN item TEXT").catch(() => {});
  console.log("Done: added item to supplier_orders");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
