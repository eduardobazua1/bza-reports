import { db } from "@/db";
import { invoices, purchaseOrders, clients, suppliers, supplierInvoices } from "@/db/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import * as XLSX from "xlsx";

// ── Sales Aging Report (OPERATIONAL) ────────────────────────────────────────
// Evolution of the Control-Union-accepted "Sales Aging Report 2025": same columns, order and level of
// detail (operational + financial). NO audit/validation columns — those live in the CoC Audit Validation Report.

const VENDOR_NAME = "BZA International Services, LLC";
const VENDOR_ADDRESS = "1209 S. 10th St. Suite #583, McAllen, TX 78501";
const FSC_LICENSE_FALLBACK = "FSC-C005174";

const HEADER = [
  "Year", "Purchase Order No.", "PO Date", "Invoice No.", "Vendor Name", "Vendor Address",
  "Customer Name", "Customer Purchase Order", "License Number", "FSC/PEFC Chain of Custody #",
  "Input", "Supplier Invoice", "Quantity", "Unit", "Output", "Supplier",
  "Price", "Total Invoice", "Cost", "Total Cost", "Profit",
  "Factoring", "Financed Amount", "Factoring Days", "Factoring Cost", "Total Profit", "Factoring Paid Date",
  "Product", "Scheme",
];
const N = HEADER.length;

function n2(v: number | null | undefined): number | "" {
  if (v == null || Number.isNaN(v)) return "";
  return Number(v.toFixed(2));
}

export async function buildSalesAgingReport(year?: string): Promise<{ buffer: Buffer; filename: string }> {
  const [rows, supRows] = await Promise.all([
    db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        quantityTons: invoices.quantityTons,
        shipmentDate: invoices.shipmentDate,
        salesDocument: invoices.salesDocument,
        clientPoId: invoices.clientPoId,
        supplierInvoiceNumber: invoices.supplierInvoiceNumber,
        invCertType: invoices.certType,
        invOutputClaim: invoices.outputClaim,
        item: invoices.item,
        sellOverride: invoices.sellPriceOverride,
        buyOverride: invoices.buyPriceOverride,
        usesFactoring: invoices.usesFactoring,
        factoringAmount: invoices.factoringAmount,
        factoringDays: invoices.factoringDays,
        factoringCost: invoices.factoringCost,
        customerPaidDate: invoices.customerPaidDate,
        poNumber: purchaseOrders.poNumber,
        poDate: purchaseOrders.poDate,
        clientPoNumber: purchaseOrders.clientPoNumber,
        poProduct: purchaseOrders.product,
        certType: purchaseOrders.certType,
        inputClaim: purchaseOrders.inputClaim,
        outputClaim: purchaseOrders.outputClaim,
        licenseFsc: purchaseOrders.licenseFsc,
        chainOfCustody: purchaseOrders.chainOfCustody,
        sellPrice: purchaseOrders.sellPrice,
        buyPrice: purchaseOrders.buyPrice,
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
      .select({ linkedId: supplierInvoices.linkedInvoiceId, number: supplierInvoices.invoiceNumber })
      .from(supplierInvoices)
      .where(isNotNull(supplierInvoices.linkedInvoiceId)),
  ]);

  const supByInvoice = new Map<number, string>();
  for (const s of supRows) {
    if (s.linkedId == null) continue;
    supByInvoice.set(s.linkedId, supByInvoice.has(s.linkedId) ? `${supByInvoice.get(s.linkedId)}, ${s.number}` : s.number);
  }

  const yearOf = (r: (typeof rows)[number]) => (r.shipmentDate || r.poDate || "").substring(0, 4);
  const filtered = year ? rows.filter((r) => yearOf(r) === year) : rows;

  const aoa: (string | number)[][] = [
    [`BZA International Services, LLC — Sales Aging Report${year ? ` — ${year}` : ""}`],
    [],
    HEADER,
  ];

  // Group by PO with a TOTAL row (quantity + financials) after each group — as in the 2025 report.
  let lastPo = "", lastYear = "";
  let poQty = 0, poTotInv = 0, poTotCost = 0, poProfit = 0, poProfitTotal = 0;
  const flushTotal = () => {
    if (!lastPo) return;
    const row: (string | number)[] = new Array(N).fill("");
    row[7] = "TOTAL"; row[12] = n2(poQty); row[17] = n2(poTotInv); row[19] = n2(poTotCost);
    row[20] = n2(poProfit); row[25] = n2(poProfitTotal);
    aoa.push(row);
  };

  for (const r of filtered) {
    const y = yearOf(r);
    if (r.poNumber !== lastPo) {
      flushTotal();
      poQty = poTotInv = poTotCost = poProfit = poProfitTotal = 0;
      lastPo = r.poNumber || "";
    }

    const scheme = (r.invCertType ?? r.certType) || "";
    const isFsc = scheme === "fsc", isPefc = scheme === "pefc";
    const license = isFsc ? (r.licenseFsc || r.supFscLicense || FSC_LICENSE_FALLBACK) : isPefc ? (r.supPefc || "") : "";
    const coc = isFsc ? (r.chainOfCustody || r.supFscCoc || "") : isPefc ? (r.supPefc || "") : "";
    const output = (r.invOutputClaim ?? r.outputClaim ?? "") || "None";
    // Operational Input: the transferred claim category (clean); no registrable claim ⇒ "None".
    const input = isFsc ? "FSC Controlled Wood" : (isPefc ? (r.inputClaim && /certified|controlled sources/i.test(r.inputClaim) ? r.inputClaim : "None") : "None");

    const qty = r.quantityTons || 0;
    const sell = (r.sellOverride ?? r.sellPrice) ?? null;
    const buy = (r.buyOverride ?? r.buyPrice) ?? null;
    const totInv = sell != null ? qty * sell : null;
    const totCost = buy != null ? qty * buy : null;
    const profit = totInv != null && totCost != null ? totInv - totCost : null;
    const factCost = r.factoringCost ?? null;
    const profitTotal = profit != null ? profit - (factCost || 0) : null;

    poQty += qty;
    if (totInv != null) poTotInv += totInv;
    if (totCost != null) poTotCost += totCost;
    if (profit != null) poProfit += profit;
    if (profitTotal != null) poProfitTotal += profitTotal;

    aoa.push([
      y !== lastYear ? y : "",
      r.poNumber ?? "",
      r.poDate ? r.poDate.substring(0, 10) : "",
      r.invoiceNumber,
      VENDOR_NAME,
      VENDOR_ADDRESS,
      r.clientName ?? "",
      r.salesDocument || r.clientPoNumber || "",
      license,
      coc,
      input,
      r.supplierInvoiceNumber || supByInvoice.get(r.invoiceId) || "",
      Number(qty.toFixed(3)),
      "Ton",
      output,
      r.supplierName ?? "",
      n2(sell), n2(totInv), n2(buy), n2(totCost), n2(profit),
      r.usesFactoring ? "Yes" : "",
      n2(r.factoringAmount), r.factoringDays ?? "", n2(factCost), n2(profitTotal), r.customerPaidDate ?? "",
      r.poProduct || r.item || "",
      scheme ? scheme.toUpperCase() : "No Claim",
    ]);
    lastYear = y;
  }
  flushTotal();

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = HEADER.map((h) => ({ wch: Math.min(30, Math.max(8, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Aging Report");
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  const stamp = new Date().toISOString().split("T")[0];
  return { buffer, filename: `BZA_Sales_Aging_Report${year ? `_${year}` : ""}_${stamp}.xlsx` };
}
