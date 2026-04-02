import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  // certType: 'fsc' | 'pefc' | null — which certification applies to this PO
  await client.execute("ALTER TABLE purchase_orders ADD COLUMN cert_type TEXT").catch(() => {});
  // pefc: PEFC certificate number for this PO (used when certType = 'pefc')
  await client.execute("ALTER TABLE purchase_orders ADD COLUMN pefc TEXT").catch(() => {});
  console.log("Done: added cert_type and pefc to purchase_orders");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
