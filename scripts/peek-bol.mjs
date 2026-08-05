import { createClient } from "@libsql/client";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const client = createClient({
  url: "libsql://bza-reports-eduardobazua1.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1NjUzMTYsImlkIjoiMDE5ZDJjNTQtYTkwMS03YjAyLTlkMDUtNzBiY2Y1ZWMyOTFmIiwicmlkIjoiMjYwZGQ4ZTktN2MyZC00YzJjLWIwNjItMDVhMzc0MDRjZTI2In0.vcdw49G9p8CixQOwZwMptY57ajkP9NqjAIW0uyzOCBakdNvktjmw6uFP1mzKT73XLNDlICsk-opllcDGOOu3Ag"
});

async function pdfToText(buffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ") + "\n";
  }
  return text;
}

const rows = await client.execute("SELECT d.file_url FROM documents d JOIN invoices i ON d.invoice_id = i.id WHERE i.invoice_number = 'IX0002-2' AND d.type = 'bl'");

console.log("Rows found:", rows.rows.length);
if (rows.rows.length === 0) { client.close(); process.exit(0); }

const b64 = String(rows.rows[0].file_url).replace(/^data:[^;]+;base64,/, "");
const text = await pdfToText(Buffer.from(b64, "base64"));

const ctx = text.match(/.{0,40}[Ss]hip\s*[Dd]ate.{0,50}/g);
console.log("Context:", ctx);

const dates = text.match(/\b\d{1,2}-[A-Za-z]{3}-\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/g);
console.log("All dates:", [...new Set(dates||[])]);

client.close();
