import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs"; import path from "path";

async function pdfToText(fp) {
  try {
    const data = new Uint8Array(fs.readFileSync(fp));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    let t = "";
    for (let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);const c=await p.getTextContent();t+=c.items.map(x=>x.str).join(" ")+"\n";}
    return t;
  } catch(e){ return ""; }
}

function suffixToDate(invNum) {
  // e.g. "4000529-0223" → 02=Feb, 23=day
  const m = invNum.match(/-(\d{2})(\d{2})$/);
  if (!m) return null;
  const mm = parseInt(m[1]), dd = parseInt(m[2]);
  const series = parseInt(invNum.replace(/-.*$/,"").replace(/\D/g,""));
  let year;
  if (series >= 4000000) year = 2026;
  else if (series >= 3002000) year = mm <= 6 ? 2026 : 2025;
  else year = 2025;
  return `${year}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
}

const dir = "/private/tmp/bza-emcee";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf") && !f.toLowerCase().includes("tally") && !f.toLowerCase().includes("bzaoct") && !f.toLowerCase().includes("bzadec") && !f.includes("BZA")).sort();

const ALREADY_IN_DB = new Set(["500450","500451","500452","500453","500454","500455","500181"]);

const results = [];
for (const file of files) {
  // Clean invoice number from filename
  const invNum = file.replace(/^(?:Invoice\s+|INVOICE\s+)/i,"").replace(/\.pdf$/i,"").replace(/\s+corrected\s+admt/i,"").replace(/\s+updated\s+rail\s+car\s+number/i,"").trim();

  if (ALREADY_IN_DB.has(invNum)) { console.log(`SKIP (in DB) ${invNum}`); continue; }

  const text = await pdfToText(path.join(dir, file));

  let invDate = null, po = null, tons = null, amount = null;

  // Format A: 4000xxx / 3002xxx — date from suffix, data in text
  if (/^\d{7}-\d{4}$/.test(invNum) || /^3002\d+-\d{4}$/.test(invNum)) {
    invDate = suffixToDate(invNum);
    const poM = text.match(/X\d{4}/);
    po = poM ? poM[0] : null;
    const tonsAll = [...text.matchAll(/\b(\d{2,3}\.\d{3})\b/g)].map(m=>parseFloat(m[1]));
    tons = tonsAll.length ? tonsAll[tonsAll.length-1] : null;
    const amtAll = [...text.matchAll(/(\d{2,3},\d{3}\.\d{2})/g)].map(m=>parseFloat(m[1].replace(",","")));
    amount = amtAll.length ? amtAll[0] : null;
  }
  // Format B: 500xxx — date from PDF text
  else if (/^500\d{3}$/.test(invNum)) {
    const poM = text.match(/X\d{4}/);
    po = poM ? poM[0] : null;
    const dateM = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateM) invDate = `${dateM[3]}-${dateM[1]}-${dateM[2]}`;
    const tonsAll = [...text.matchAll(/\b(\d{2,3}\.\d{3})\b/g)].map(m=>parseFloat(m[1]));
    tons = tonsAll.length ? tonsAll[tonsAll.length-1] : null;
    const amtAll = [...text.matchAll(/(\d{2,3},\d{3}\.\d{2})/g)].map(m=>parseFloat(m[1].replace(",","")));
    amount = amtAll.length ? amtAll[0] : null;
  }
  // Format C: 3000xxx/3001xxx — scanned, skip for now
  else {
    console.log(`SCANNED ${invNum} (no extractable date)`);
    continue;
  }

  if (invDate && po && tons) {
    results.push({ invNum, invDate, po, tons, amount });
    console.log(`✓ ${invNum.padEnd(30)} ${invDate}  PO:${po}  ${String(tons).padStart(7)}t  $${amount}`);
  } else {
    console.log(`MISS ${invNum} date=${invDate} po=${po} tons=${tons}`);
  }
}

fs.writeFileSync("/private/tmp/bza-emcee/parsed.json", JSON.stringify(results, null, 2));
console.log(`\nExtractable: ${results.length} invoices`);
