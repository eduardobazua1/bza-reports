import { db } from "@/db";
import {
  invoices, purchaseOrders, clients, suppliers, supplierInvoices, certificates, customerCertificates, documents,
} from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

// ── Chain-of-Custody audit engine ──────────────────────────────────────────
// Validates each operation end-to-end (Supplier docs → Input Claim → BZA → Customer → Output Claim)
// against the 6-condition business rule. NO hardcoded certs, NO inferred claims.
// Rules & citations: see memory sales_aging_report_spec.md (Handbook + FSC-STD-40-004 / PEFC ST 2002 + Control Union audits).

export const VENDOR_NAME = "BZA International Services, LLC";
export const VENDOR_ADDRESS = "1209 S. 10th St. Suite #583, McAllen, TX 78501";

export type AuditRow = {
  year: string;
  po: string;
  poDate: string;
  bzaInvoice: string;
  supplierInvoice: string;
  supplier: string;
  supplierMasterCert: string;
  supplierCertDocumented: string;
  supplierStatementRaw: string;
  inputClaim: string;
  outputClaim: string;
  bzaCertificate: string;
  customer: string;
  customerCertStatus: string;
  evidenceSource: string;
  scheme: string; // FSC | PEFC | No Claim
  product: string;
  quantity: number;
  auditValidation: string;
  exceptionReason: string;
  // documental completeness (audit readiness)
  hasBL: boolean;
  hasPL: boolean;
  hasSupplierInvoice: boolean;
  docComplete: boolean;
};

// An explicit, registrable input claim. Raw "non controversial sources" text and blanks do NOT
// qualify — but a reconciled, documented scheme claim (incl. "per Arauco official history", the
// authoritative source we agreed on) DOES. This is not inferring from invoice text; it is the
// reconciled Input Claim backed by the supplier's PEFC/FSC master certificate.
function inputIsRegistrable(inputClaim: string | null): boolean {
  if (!inputClaim) return false;
  const s = inputClaim.toLowerCase();
  if (s.includes("no claim") || s.includes("non controversial") || s.includes("not evidenced") || s.includes("pending") || s.includes("raw supplier statement")) return false;
  return s.includes("fsc") || s.includes("pefc") || s.includes("controlled") || s.includes("certified") || s.includes("recycled") || s.includes("mix") || s.includes("arauco");
}
function certDocumented(cert: string | null): boolean {
  if (!cert) return false;
  const s = cert.toLowerCase();
  return !(s.includes("not stated") || s.includes("not printed") || s.trim() === "");
}
// output is a positive claim (not None / No Claim)
function outputIsClaim(out: string | null): boolean {
  if (!out) return false;
  const s = out.trim().toLowerCase();
  return !(s.startsWith("none") || s.startsWith("no claim") || s === "");
}
// claim strength tier for "output must not exceed input"
function tier(claim: string | null): number {
  const s = (claim || "").toLowerCase();
  if (!outputIsClaim(claim)) return 0;
  if (s.includes("controlled")) return 1; // Controlled Wood / Controlled Sources (lower tier — check first)
  return 2; // Certified / PEFC / FSC 100% / Mix / Recycled
}

export async function getAuditRows(): Promise<AuditRow[]> {
  const [bzaCerts, rows, supEvidence, custCerts, docFlags] = await Promise.all([
    db.select().from(certificates),
    db
      .select({
        invoiceId: invoices.id,
        bzaInvoice: invoices.invoiceNumber,
        quantityTons: invoices.quantityTons,
        shipmentDate: invoices.shipmentDate,
        item: invoices.item,
        invCertType: invoices.certType,
        invOutputClaim: invoices.outputClaim,
        clientId: purchaseOrders.clientId,
        poNumber: purchaseOrders.poNumber,
        poDate: purchaseOrders.poDate,
        poProduct: purchaseOrders.product,
        poCertType: purchaseOrders.certType,
        poOutputClaim: purchaseOrders.outputClaim,
        clientName: clients.name,
        supplierName: suppliers.name,
        supFscLicense: suppliers.fscLicense,
        supFscCoc: suppliers.fscChainOfCustody,
        supPefc: suppliers.pefc,
      })
      .from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(clients, eq(purchaseOrders.clientId, clients.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .orderBy(sql`substr(coalesce(${invoices.shipmentDate}, ${purchaseOrders.poDate}), 1, 10)`, purchaseOrders.poNumber, invoices.invoiceNumber),
    db
      .select({
        linkedId: supplierInvoices.linkedInvoiceId,
        number: supplierInvoices.invoiceNumber,
        statementRaw: supplierInvoices.supplierStatementRaw,
        certDoc: supplierInvoices.supplierCertDocumented,
        inputClaim: supplierInvoices.inputClaimEvidenced,
        evidenceSource: supplierInvoices.evidenceSource,
      })
      .from(supplierInvoices),
    db.select().from(customerCertificates),
    // Index-only scan (idx_documents_inv_type) — never reads the base64 file blobs.
    db.select({ invoiceId: documents.invoiceId, type: documents.type }).from(documents),
  ]);

  const docsByInvoice = new Map<number, { bl: boolean; pl: boolean }>();
  for (const d of docFlags) {
    const cur = docsByInvoice.get(d.invoiceId) ?? { bl: false, pl: false };
    if (d.type === "bl") cur.bl = true;
    if (d.type === "pl") cur.pl = true;
    docsByInvoice.set(d.invoiceId, cur);
  }

  const bzaFsc = bzaCerts.find((c) => c.certType === "fsc");
  const bzaPefc = bzaCerts.find((c) => c.certType === "pefc");
  const evByInvoice = new Map<number, (typeof supEvidence)[number]>();
  for (const e of supEvidence) if (e.linkedId != null && !evByInvoice.has(e.linkedId)) evByInvoice.set(e.linkedId, e);
  const custByKey = new Map<string, (typeof custCerts)[number]>();
  for (const cc of custCerts) custByKey.set(`${cc.clientId}:${cc.scheme}`, cc);

  const out: AuditRow[] = [];
  for (const r of rows) {
    const year = (r.shipmentDate || r.poDate || "").substring(0, 4);
    const ev = evByInvoice.get(r.invoiceId);
    const scheme = ((r.invCertType ?? r.poCertType) || "").toLowerCase(); // fsc | pefc | ''
    const outputClaim = (r.invOutputClaim ?? r.poOutputClaim ?? "") || "";
    const inputClaim = ev?.inputClaim || "No Claim Evidenced";
    const evidenceSource = ev?.evidenceSource || "Not Evidenced";
    const supplierStatementRaw = ev?.statementRaw || "";
    const supplierCertDoc = ev?.certDoc || "Not stated on supplier document";
    const supplierMasterCert = scheme === "pefc" ? (r.supPefc || "") : (r.supFscLicense ? `${r.supFscLicense} / ${r.supFscCoc || ""}` : "");
    const bzaCert = scheme === "pefc" ? (bzaPefc?.certCode || "") : (scheme === "fsc" ? (bzaFsc?.certCode || "") : "");

    const cust = scheme ? custByKey.get(`${r.clientId}:${scheme}`) : undefined;
    const custStatus = !outputIsClaim(outputClaim) ? "n/a (no claim)" : (cust ? cust.status || "pending" : "not in master");

    // ── 6-condition validation ──
    let auditValidation = "Verified";
    let reason = "";
    if (!outputIsClaim(outputClaim)) {
      auditValidation = "Verified (No Claim)";
      reason = "BZA transferred no FSC/PEFC claim → consistent regardless of input.";
    } else {
      // output carries a claim → all conditions must hold
      const cond1 = inputIsRegistrable(inputClaim);                    // supplier documents a registrable claim
      const cond2 = certDocumented(supplierCertDoc);                   // supplier certificate ALWAYS required
      const bzaValid = scheme === "fsc" ? !!bzaFsc : scheme === "pefc" ? !!bzaPefc : false; // BZA cert exists
      const cond4 = cust ? (cust.status || "").toLowerCase() === "valid" : false; // customer cert valid
      const cond5 = tier(outputClaim) <= (cond1 ? tier(inputClaim) : 0); // output must not exceed input
      const cond6 = !!bzaCert;                                          // BZA invoice mandatory cert info

      if (!cond2) { auditValidation = "Document Missing"; reason = "Supplier certificate not documented — the certificate number (e.g. SGSCH-PEFC-COC-820008) must be recorded for every certified operation."; }
      else if (!cond1) { auditValidation = "Review Required"; reason = "Output Claim not supported by a registrable input claim from the supplier."; }
      else if (!cond5) { auditValidation = "Review Required"; reason = `Output Claim ("${outputClaim}") exceeds the input claim ("${inputClaim}").`; }
      else if (!bzaValid || !cond6) { auditValidation = "Review Required"; reason = "BZA certificate missing/invalid for the scheme."; }
      else if (!cond4) { auditValidation = "Pending Customer Verification"; reason = `Customer certification not verified (status: ${custStatus}). Confirm ${(scheme || "").toUpperCase()} certificate in the Customer Certification Master before issuing a claim.`; }
      else { auditValidation = "Verified"; reason = ""; }
    }

    const dflag = docsByInvoice.get(r.invoiceId) ?? { bl: false, pl: false };
    const hasSupplierInvoice = !!ev;

    out.push({
      year, po: r.poNumber || "", poDate: r.poDate ? r.poDate.substring(0, 10) : "",
      bzaInvoice: r.bzaInvoice, supplierInvoice: ev?.number || "",
      supplier: r.supplierName || "", supplierMasterCert, supplierCertDocumented: supplierCertDoc,
      supplierStatementRaw, inputClaim, outputClaim: outputClaim || "No Claim",
      bzaCertificate: bzaCert, customer: r.clientName || "", customerCertStatus: custStatus,
      evidenceSource, scheme: scheme ? scheme.toUpperCase() : "No Claim",
      product: r.poProduct || r.item || "", quantity: Number((r.quantityTons || 0).toFixed(3)),
      auditValidation, exceptionReason: reason,
      hasBL: dflag.bl, hasPL: dflag.pl, hasSupplierInvoice,
      docComplete: dflag.bl && dflag.pl && hasSupplierInvoice,
    });
  }
  return out;
}

// ── Report builders ─────────────────────────────────────────────────────────
import * as XLSX from "xlsx";

const AUDIT_COLUMNS = [
  "Year", "PO", "PO Date", "BZA Invoice", "Supplier Invoice", "Supplier", "Scheme",
  "Supplier Master Certificate", "Supplier Certificate (documented)", "Supplier Statement (Raw)",
  "Input Claim", "Output Claim", "BZA Certificate", "Customer", "Customer Cert Status",
  "Evidence Source", "Product", "Quantity", "Unit", "Audit Validation", "Exception Reason",
];

function rowToArray(r: AuditRow): (string | number)[] {
  return [
    r.year, r.po, r.poDate, r.bzaInvoice, r.supplierInvoice, r.supplier, r.scheme,
    r.supplierMasterCert, r.supplierCertDocumented, r.supplierStatementRaw,
    r.inputClaim, r.outputClaim, r.bzaCertificate, r.customer, r.customerCertStatus,
    r.evidenceSource, r.product, r.quantity, "Ton", r.auditValidation, r.exceptionReason,
  ];
}

function toXlsx(header: string[], rows: (string | number)[][], sheet: string, title: string): Buffer {
  const aoa: (string | number)[][] = [[title], [], header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((h) => ({ wch: Math.min(46, Math.max(10, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/** CoC Audit Validation Report (INTERNAL) — every operation with full validation columns. */
export async function buildCocAuditReport(year?: string): Promise<{ buffer: Buffer; filename: string }> {
  let rows = await getAuditRows();
  if (year) rows = rows.filter((r) => r.year === year);
  const buffer = toXlsx(AUDIT_COLUMNS, rows.map(rowToArray), "CoC Audit Validation",
    `BZA International Services, LLC — CoC Audit Validation Report (internal)${year ? ` — ${year}` : ""}`);
  const stamp = new Date().toISOString().split("T")[0];
  return { buffer, filename: `BZA_CoC_Audit_Validation_Report${year ? `_${year}` : ""}_${stamp}.xlsx` };
}

/** Audit Exception Report — only operations whose Output Claim is not supported end-to-end. */
export async function buildExceptionReport(): Promise<{ buffer: Buffer; filename: string; count: number; pending: number }> {
  const rows = await getAuditRows();
  const exceptions = rows.filter((r) => r.auditValidation === "Review Required" || r.auditValidation === "Document Missing");
  const pending = rows.filter((r) => r.auditValidation === "Pending Customer Verification").length;
  const buffer = toXlsx(AUDIT_COLUMNS, exceptions.map(rowToArray), "Audit Exceptions",
    "BZA International Services, LLC — Audit Exception Report (Output Claim not supported by input documentation)");
  const stamp = new Date().toISOString().split("T")[0];
  return { buffer, filename: `BZA_Audit_Exception_Report_${stamp}.xlsx`, count: exceptions.length, pending };
}

/** Validation summary counts (for dashboards / the report page). */
export async function getValidationSummary(): Promise<Record<string, number>> {
  const rows = await getAuditRows();
  const cnt: Record<string, number> = {};
  for (const r of rows) cnt[r.auditValidation] = (cnt[r.auditValidation] || 0) + 1;
  return cnt;
}

// ── Audit readiness (documental completeness semaphore) ─────────────────────
export type ReadinessRow = {
  bzaInvoice: string; po: string; customer: string; scheme: string; quantity: number;
  hasBL: boolean; hasPL: boolean; hasSupplierInvoice: boolean; docComplete: boolean;
  auditValidation: string; outputClaim: string;
};

/** Slim per-operation readiness rows for the semaphore UI (no blobs, no raw statements). */
export async function getReadinessRows(): Promise<ReadinessRow[]> {
  const rows = await getAuditRows();
  return rows.map((r) => ({
    bzaInvoice: r.bzaInvoice, po: r.po, customer: r.customer, scheme: r.scheme, quantity: r.quantity,
    hasBL: r.hasBL, hasPL: r.hasPL, hasSupplierInvoice: r.hasSupplierInvoice, docComplete: r.docComplete,
    auditValidation: r.auditValidation, outputClaim: r.outputClaim,
  }));
}
