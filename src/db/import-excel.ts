import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "sqlite.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

function excelDateToISO(serial: number | string | null | undefined): string | null {
  if (!serial) return null;
  if (typeof serial === "string") {
    if (serial === "pending") return null;
    const d = new Date(serial);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return null;
  }
  // Excel serial date
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().split("T")[0];
}

function mapTransportType(type: string | null): "ffcc" | "ship" | "truck" | null {
  if (!type) return null;
  const t = type.toLowerCase().trim();
  if (t === "ffcc") return "ffcc";
  if (t === "ship" || t === "maritimo" || t === "barco") return "ship";
  if (t === "truck" || t === "camion") return "truck";
  return null;
}

function mapPaymentStatus(status: string | null): "paid" | "unpaid" {
  if (!status) return "unpaid";
  return status.toLowerCase().trim() === "paid" ? "paid" : "unpaid";
}

async function importExcel() {
  const filePath = path.resolve(
    process.env.HOME || "",
    "Library/Mobile Documents/com~apple~CloudDocs/PEFC : BZA/PEFC 2025/Sales Aging Report..2025.xlsx"
  );

  console.log("Reading Excel:", filePath);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["Hoja1 (2)"];
  if (!sheet) {
    console.error("Sheet 'Hoja1 (2)' not found");
    return;
  }

  // Parse rows - the data starts at row 4 (0-indexed row 3) after headers
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];

  // Cache for created entities
  const clientsMap = new Map<string, number>();
  const suppliersMap = new Map<string, number>();
  const posMap = new Map<string, number>();

  let importedInvoices = 0;
  let importedPOs = 0;

  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 10) continue;

    // Column indices (0-based): A=0(year), B=1(PO#), C=2(date), D=3(inv#),
    // E=4(vendor), F=5(address), G=6(customer), H=7(custPO),
    // I=8(license), J=9(chain), K=10(input), L=11(supplierInv),
    // M=12(qty), N=13(unit), O=14(output), P=15(supplier),
    // Q=16(sellPrice), R=17(totalInv), S=18(buyPrice), T=19(totalCost),
    // U=20(profit), V=21(factoraje)...
    // AB=27(shipDate), AC=28(statusCust), AD=29(item), AE=30(terms), AF=31(type)

    const poNumber = row[1] as string;
    const customer = row[6] as string;
    const quantity = row[12] as number;
    const supplier = row[15] as string;
    const sellPrice = row[16] as number;

    // Skip TOTAL rows and empty rows
    if (!poNumber || customer === "TOTAL" || !quantity || !supplier) continue;
    if (typeof quantity !== "number" || quantity <= 0) continue;

    const invoiceNumber = row[3] as string;
    if (!invoiceNumber) continue;

    const poDate = excelDateToISO(row[2] as number | string);
    const customerPO = row[7] as string;
    const licenseFsc = row[8] as string;
    const chainOfCustody = row[9] as string;
    const inputClaim = row[10] as string;
    const outputClaim = row[14] as string;
    const buyPrice = row[18] as number;
    const factoraje = row[21] as string;
    const shipmentDate = excelDateToISO(row[27] as number | string);
    const paymentStatus = row[28] as string;
    const item = row[29] as string;
    const terms = row[30] as string;
    const transportType = row[31] as string;

    // Create client if needed
    if (customer && !clientsMap.has(customer)) {
      const existing = db.select().from(schema.clients).where(eq(schema.clients.name, customer)).get();
      if (existing) {
        clientsMap.set(customer, existing.id);
      } else {
        const result = db.insert(schema.clients).values({
          name: customer,
          accessToken: uuidv4(),
          portalEnabled: true,
        }).returning().get();
        clientsMap.set(customer, result.id);
        console.log(`  Created client: ${customer}`);
      }
    }

    // Create supplier if needed
    if (supplier && !suppliersMap.has(supplier)) {
      const existing = db.select().from(schema.suppliers).where(eq(schema.suppliers.name, supplier)).get();
      if (existing) {
        suppliersMap.set(supplier, existing.id);
      } else {
        const result = db.insert(schema.suppliers).values({
          name: supplier,
        }).returning().get();
        suppliersMap.set(supplier, result.id);
        console.log(`  Created supplier: ${supplier}`);
      }
    }

    // Create PO if needed
    if (poNumber && !posMap.has(poNumber)) {
      const existing = db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.poNumber, poNumber)).get();
      if (existing) {
        posMap.set(poNumber, existing.id);
      } else {
        const clientId = clientsMap.get(customer);
        const supplierId = suppliersMap.get(supplier);
        if (!clientId || !supplierId || !sellPrice || !buyPrice) {
          console.log(`  Skipping PO ${poNumber}: missing data`);
          continue;
        }

        // Determine if all invoices in this PO are paid
        const allPaid = paymentStatus?.toLowerCase() === "paid";

        const result = db.insert(schema.purchaseOrders).values({
          poNumber,
          poDate,
          clientId,
          clientPoNumber: customerPO?.toString(),
          supplierId,
          sellPrice: typeof sellPrice === "number" ? sellPrice : 0,
          buyPrice: typeof buyPrice === "number" ? buyPrice : 0,
          product: item || "Unknown",
          terms: terms || null,
          transportType: mapTransportType(transportType),
          licenseFsc: licenseFsc?.toString() || null,
          chainOfCustody: chainOfCustody?.toString() || null,
          inputClaim: inputClaim?.toString() || null,
          outputClaim: outputClaim?.toString() || null,
          status: allPaid ? "completed" : "active",
        }).returning().get();
        posMap.set(poNumber, result.id);
        importedPOs++;
      }
    }

    // Create invoice
    const poId = posMap.get(poNumber);
    if (!poId) continue;

    const existingInvoice = db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, invoiceNumber)).get();
    if (existingInvoice) continue;

    // Check if this invoice has a different price than the PO default
    const po = db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, poId)).get();
    const sellOverride = (typeof sellPrice === "number" && po && sellPrice !== po.sellPrice) ? sellPrice : null;
    const buyOverride = (typeof buyPrice === "number" && po && buyPrice !== po.buyPrice) ? buyPrice : null;

    db.insert(schema.invoices).values({
      invoiceNumber,
      purchaseOrderId: poId,
      quantityTons: quantity,
      unit: "Ton",
      sellPriceOverride: sellOverride,
      buyPriceOverride: buyOverride,
      shipmentDate,
      shipmentStatus: paymentStatus?.toLowerCase() === "paid" ? "entregado" : "programado",
      customerPaymentStatus: mapPaymentStatus(paymentStatus),
      supplierPaymentStatus: mapPaymentStatus(paymentStatus), // assume same
      usesFactoring: factoraje === "Si",
      item: item || null,
    }).run();
    importedInvoices++;
  }

  console.log(`\nImport complete!`);
  console.log(`  POs created: ${importedPOs}`);
  console.log(`  Invoices created: ${importedInvoices}`);
  console.log(`  Clients: ${clientsMap.size}`);
  console.log(`  Suppliers: ${suppliersMap.size}`);
}

importExcel().catch(console.error);
