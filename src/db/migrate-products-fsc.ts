import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const cols = [
    "ALTER TABLE products ADD COLUMN fsc_license TEXT",
    "ALTER TABLE products ADD COLUMN chain_of_custody TEXT",
    "ALTER TABLE products ADD COLUMN input_claim TEXT",
    "ALTER TABLE products ADD COLUMN output_claim TEXT",
    "ALTER TABLE products ADD COLUMN pefc TEXT",
  ];
  for (const sql of cols) {
    await client.execute(sql).catch(() => {});
  }

  // Clear test data and insert real products
  await client.execute("DELETE FROM products");

  const prods = [
    {
      name: "White Gold 316",
      grade: "NBSK",
      description: "Softwood bleached kraft pulp — Cascade Pacific Pulp",
      fsc_license: "FSC-C005174",
      chain_of_custody: "SCS-CW-000885",
      input_claim: "FSC Controlled Wood",
      output_claim: "FSC Controlled Wood",
      pefc: null,
    },
    {
      name: "Woodpulp",
      grade: "NBSK",
      description: "Softwood — Cascade Pacific Pulp",
      fsc_license: "FSC-C005174",
      chain_of_custody: "SCS-CW-000885",
      input_claim: "FSC Controlled Wood",
      output_claim: "FSC Controlled Wood",
      pefc: null,
    },
    {
      name: "Bleached Eucalyptus Kraft Pulp",
      grade: "BHK",
      description: "Hardwood eucalyptus — Arauco",
      fsc_license: "FSC-006552",
      chain_of_custody: "SGSCH-COC-006455",
      input_claim: "100% PEFC Certified",
      output_claim: "100% PEFC Certified",
      pefc: "PEFC-2431400",
    },
    {
      name: "Bleached Hardwood Kraft Pulp Acacia",
      grade: "BHK",
      description: "Hardwood acacia — Arauco",
      fsc_license: "FSC-006552",
      chain_of_custody: "ITKUS-PEFC-COC-003061",
      input_claim: "100% PEFC Certified",
      output_claim: "100% PEFC Certified",
      pefc: "PEFC-2431400",
    },
  ];

  const now = new Date().toISOString();
  for (const p of prods) {
    await client.execute({
      sql: `INSERT INTO products (name, grade, description, fsc_license, chain_of_custody, input_claim, output_claim, pefc, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [p.name, p.grade, p.description, p.fsc_license, p.chain_of_custody, p.input_claim, p.output_claim, p.pefc, now, now],
    });
  }

  console.log("Done");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
