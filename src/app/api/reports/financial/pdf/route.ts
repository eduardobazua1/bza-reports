import { NextRequest, NextResponse } from "next/server";
import { getInvoices } from "@/server/queries";
import { buildFinancialPdf, type PdfRow } from "@/lib/financial-pdf";

export async function GET(req: NextRequest) {
  const sp          = req.nextUrl.searchParams;
  const tab         = sp.get("tab") ?? "ar-aging";
  const colKeys     = (sp.get("cols") ?? "invoiceNumber,clientName,product,date,dueDate,days,tons,amount,custPayment").split(",").filter(Boolean);
  const dateFrom    = sp.get("dateFrom") ?? "";
  const dateTo      = sp.get("dateTo")   ?? "";
  const disposition = sp.get("disposition") ?? "inline";

  const allRows = await getInvoices();

  const data: PdfRow[] = allRows.map(row => {
    const sellPrice  = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice   = row.invoice.buyPriceOverride  ?? row.poBuyPrice  ?? 0;
    const revenue    = row.invoice.quantityTons * sellPrice;
    const costNoFrt  = row.invoice.quantityTons * buyPrice;
    const freight    = row.invoice.freightCost ?? 0;
    const cost       = costNoFrt + freight;
    const profit     = revenue - cost;
    const terms      = row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays : (row.clientPaymentTermsDays ?? 60);
    const base = row.invoice.invoiceDate || row.invoice.shipmentDate;
    let dueDate: string | null = null;
    if (base) {
      const d = new Date(base + "T12:00:00");
      d.setDate(d.getDate() + terms);
      dueDate = d.toISOString().split("T")[0];
    }
    return {
      invoiceNumber:         row.invoice.invoiceNumber,
      clientName:            row.clientName           ?? "Unknown",
      supplierName:          row.supplierName         ?? "Unknown",
      poNumber:              row.poNumber             ?? "",
      invoiceDate:           row.invoice.invoiceDate,
      shipmentDate:          row.invoice.shipmentDate,
      dueDate,
      quantityTons:          row.invoice.quantityTons,
      revenue, cost, profit,
      customerPaymentStatus: row.invoice.customerPaymentStatus,
      shipmentStatus:        row.invoice.shipmentStatus,
      destination:           row.invoice.destination,
      product:               row.invoice.item ?? row.product,
    };
  }).filter(r => {
    const d = r.invoiceDate || r.shipmentDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo   && d && d > dateTo)   return false;
    return true;
  });

  const rows = tab === "ar-aging" ? data.filter(r => r.customerPaymentStatus === "unpaid") : data;

  const LABELS: Record<string, string> = {
    "ar-aging":    "Accounts Receivable Aging",
    "pl-monthly":  "Profit and Loss by Month",
    "pl-customer": "Profit and Loss by Customer",
    "pl-supplier": "Profit and Loss by Supplier",
  };
  const title = LABELS[tab] ?? "Financial Report";

  const dateStr  = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const safeTitle = title.replace(/[^a-zA-Z0-9_]/g, "_");

  try {
    const buf = await buildFinancialPdf(rows, title, colKeys);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="BZA_${safeTitle}_${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF error" }, { status: 500 });
  }
}
