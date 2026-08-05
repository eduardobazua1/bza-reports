import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";

const client = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

const ICLOUD = "/Users/eduardobazua/Library/Mobile Documents/com~apple~CloudDocs/BOLS CASCADE";

// The 26 matched BZA invoices and their IDs
// Already have BOL+PL: IX0041-6(175), IX0042-1(176),-2(177),-3(178), IX0043-6(195),-7(196)
// Need BOL (available in iCloud):
const needBOL = [
  { inv: "IX0037-1", id: 147 }, { inv: "IX0037-2", id: 148 }, { inv: "IX0037-3", id: 149 },
  { inv: "IX0039-1", id: 157 }, { inv: "IX0039-2", id: 158 }, { inv: "IX0039-3", id: 159 },
  { inv: "IX0039-4", id: 161 }, { inv: "IX0039-5", id: 162 }, { inv: "IX0039-6", id: 163 },
  { inv: "IX0039-7", id: 160 },
  { inv: "IX0040-2", id: 165 }, { inv: "IX0040-3", id: 166 }, { inv: "IX0040-4", id: 167 },
  { inv: "IX0040-5", id: 168 }, { inv: "IX0040-6", id: 169 },
  { inv: "IX0041-1", id: 170 }, { inv: "IX0041-2", id: 171 }, { inv: "IX0041-3", id: 172 },
  { inv: "IX0041-4", id: 173 }, { inv: "IX0041-5", id: 174 },
];

// PL files available in iCloud for these (check)
// Only IX0041-6, IX0042, IX0043 have PL in iCloud — rest don't

let inserted = 0, skipped = 0, errors = 0;

for (const { inv, id } of needBOL) {
  for (const type of ['bl', 'pl']) {
    const prefix = type === 'bl' ? 'BOL' : 'PL';
    const fileName = `${prefix} ${inv}.pdf`;
    const filePath = `${ICLOUD}/${fileName}`;

    if (!existsSync(filePath)) {
      if (type === 'pl') {
        console.log(`  ⚠️  No PL found for ${inv}`);
      } else {
        console.log(`  ❌ BOL missing for ${inv}!`);
      }
      skipped++;
      continue;
    }

    // Check if already in DB
    const existing = await client.execute({
      sql: "SELECT id FROM documents WHERE invoice_id = ? AND type = ?",
      args: [id, type]
    });
    if (existing.rows.length > 0) {
      console.log(`  ✓  ${fileName} already in DB`);
      skipped++;
      continue;
    }

    const buf = readFileSync(filePath);
    const fileUrl = `data:application/pdf;base64,${buf.toString("base64")}`;

    try {
      await client.execute({
        sql: "INSERT INTO documents (invoice_id, type, file_name, file_url, file_size, uploaded_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",
        args: [id, type, fileName, fileUrl, buf.length]
      });
      console.log(`  ✅ ${fileName} (${(buf.length/1024).toFixed(0)} KB)`);
      inserted++;
    } catch (e) {
      console.log(`  ❌ ${fileName}: ${e.message}`);
      errors++;
    }
  }
}

console.log(`\n✅ Inserted: ${inserted} | Skipped/missing: ${skipped} | Errors: ${errors}`);
client.close();
