import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  await client.execute("ALTER TABLE client_purchase_orders ADD COLUMN item TEXT").catch(() => {});
  await client.execute("ALTER TABLE client_purchase_orders ADD COLUMN incoterm TEXT").catch(() => {});
  await client.execute("ALTER TABLE client_purchase_orders ADD COLUMN sell_price_override REAL").catch(() => {});
  console.log("Done: added item, incoterm, sell_price_override to client_purchase_orders");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
