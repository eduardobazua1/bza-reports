import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getInvoices } from "@/server/queries";

function daysOverdue(dueDate: string | null): number {
  if (!dueDate) return 0;
  return Math.floor((Date.now() - new Date(dueDate + "T12:00:00").getTime()) / 86400000);
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const p = d.split("T")[0].split("-");
  return `${p[1].padStart(2,"0")}/${p[2].padStart(2,"0")}/${p[0]}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tab = searchParams.get("tab") ?? "ar-aging";
  const cols = new Set((searchParams.get("cols") ?? "").split(",").filter(Boolean));
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const rows = await getInvoices();

  // Build flat data
  const data = rows.map((row) => {
    const sellPrice = row.invoice.sellPriceOverride ?? row.poSellPrice ?? 0;
    const buyPrice = row.invoice.buyPriceOverride ?? row.poBuyPrice ?? 0;
    const revenue = row.invoice.quantityTons * sellPrice;
    const costNoFreight = row.invoice.quantityTons * buyPrice;
    const freight = row.invoice.freightCost ?? 0;
    const cost = costNoFreight + freight;
    const profit = revenue - cost;
    const terms = row.invoice.paymentTermsDays != null && row.invoice.paymentTermsDays > 0
      ? row.invoice.paymentTermsDays
      : (row.clientPaymentTermsDays ?? 60);
    const base = row.invoice.invoiceDate || row.invoice.shipmentDate;
    let dueDate: string | null = null;
    if (base) {
      const d = new Date(base + "T12:00:00");
      d.setDate(d.getDate() + terms);
      dueDate = d.toISOString().split("T")[0];
    }
    const transport =
      row.transportType === "ffcc" ? "Railroad" :
      row.transportType === "ship" ? "Maritime" :
      row.transportType === "truck" ? "Truck" : "Other";
    return {
      invoiceNumber: row.invoice.invoiceNumber,
      clientName: row.clientName ?? "Unknown",
      supplierName: row.supplierName ?? "Unknown",
      poNumber: row.poNumber ?? "",
      invoiceDate: row.invoice.invoiceDate,
      shipmentDate: row.invoice.shipmentDate,
      dueDate,
      quantityTons: row.invoice.quantityTons,
      sellPrice, buyPrice,
      revenue, costNoFreight, freight, cost, profit,
      customerPaymentStatus: row.invoice.customerPaymentStatus,
      supplierPaymentStatus: row.invoice.supplierPaymentStatus,
      destination: row.invoice.destination,
      product: row.invoice.item ?? row.product,
      transportType: transport,
    };
  }).filter((r) => {
    const d = r.shipmentDate || r.invoiceDate;
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo && d && d > dateTo) return false;
    return true;
  });

  let sheetData: (string | number)[][] = [];
  let sheetName = "Report";

  // ── AR Aging ──────────────────────────────────────────────────────────────
  if (tab === "ar-aging") {
    sheetName = "AR Aging";
    const colLabels: Record<string, string> = {
      client: "Client", invoice: "Invoice #", po: "PO #", product: "Product",
      invoiceDate: "Invoice Date", dueDate: "Due Date", days: "Days Overdue",
      amount: "Amount", current: "Current", d30: "1-30 days",
      d60: "31-60 days", d90: "61-90 days", d90plus: "90+ days",
    };
    const headers = Object.keys(colLabels).filter((k) => cols.has(k)).map((k) => colLabels[k]);
    sheetData = [headers];

    const unpaid = data.filter((r) => r.customerPaymentStatus === "unpaid" && r.revenue > 0);
    unpaid.forEach((r) => {
      const days = daysOverdue(r.dueDate);
      const row: (string | number)[] = [];
      if (cols.has("client")) row.push(r.clientName);
      if (cols.has("invoice")) row.push(r.invoiceNumber);
      if (cols.has("po")) row.push(r.poNumber);
      if (cols.has("product")) row.push(r.product ?? "");
      if (cols.has("invoiceDate")) row.push(fmtDate(r.invoiceDate));
      if (cols.has("dueDate")) row.push(fmtDate(r.dueDate));
      if (cols.has("days")) row.push(days <= 0 ? "Not due" : days);
      if (cols.has("amount")) row.push(r.revenue);
      if (cols.has("current")) row.push(days <= 0 ? r.revenue : 0);
      if (cols.has("d30")) row.push(days > 0 && days <= 30 ? r.revenue : 0);
      if (cols.has("d60")) row.push(days > 30 && days <= 60 ? r.revenue : 0);
      if (cols.has("d90")) row.push(days > 60 && days <= 90 ? r.revenue : 0);
      if (cols.has("d90plus")) row.push(days > 90 ? r.revenue : 0);
      sheetData.push(row);
    });

    // Totals row
    if (unpaid.length > 0) {
      const totRow: (string | number)[] = [];
      if (cols.has("client")) totRow.push("TOTAL");
      if (cols.has("invoice")) totRow.push("");
      if (cols.has("po")) totRow.push("");
      if (cols.has("product")) totRow.push("");
      if (cols.has("invoiceDate")) totRow.push("");
      if (cols.has("dueDate")) totRow.push("");
      if (cols.has("days")) totRow.push("");
      const sum = (fn: (r: typeof unpaid[0]) => number) => unpaid.reduce((s, r) => s + fn(r), 0);
      if (cols.has("amount")) totRow.push(sum((r) => r.revenue));
      if (cols.has("current")) totRow.push(sum((r) => daysOverdue(r.dueDate) <= 0 ? r.revenue : 0));
      if (cols.has("d30")) totRow.push(sum((r) => { const d = daysOverdue(r.dueDate); return d > 0 && d <= 30 ? r.revenue : 0; }));
      if (cols.has("d60")) totRow.push(sum((r) => { const d = daysOverdue(r.dueDate); return d > 30 && d <= 60 ? r.revenue : 0; }));
      if (cols.has("d90")) totRow.push(sum((r) => { const d = daysOverdue(r.dueDate); return d > 60 && d <= 90 ? r.revenue : 0; }));
      if (cols.has("d90plus")) totRow.push(sum((r) => daysOverdue(r.dueDate) > 90 ? r.revenue : 0));
      sheetData.push(totRow);
    }
  }

  // ── P&L by Month ──────────────────────────────────────────────────────────
  else if (tab === "pl-monthly") {
    sheetName = "P&L by Month";
    const colLabels: Record<string, string> = {
      month: "Month", invoices: "Invoices", tons: "Tons",
      revenue: "Revenue", costNoFreight: "Cost (ex-freight)", freight: "Freight",
      totalCost: "Total Cost", profit: "Profit", margin: "Margin %",
      avgSell: "Avg Sell/TN", avgBuy: "Avg Buy/TN", marginTon: "Margin/TN",
    };
    sheetData = [Object.keys(colLabels).filter((k) => cols.has(k)).map((k) => colLabels[k])];

    const map = new Map<string, { invoices: number; tons: number; revenue: number; costNoFreight: number; freight: number; cost: number; profit: number }>();
    data.forEach((r) => {
      const d = r.shipmentDate || r.invoiceDate;
      if (!d) return;
      const key = d.slice(0, 7);
      if (!map.has(key)) map.set(key, { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0 });
      const m = map.get(key)!;
      m.invoices += 1; m.tons += r.quantityTons; m.revenue += r.revenue;
      m.costNoFreight += r.costNoFreight; m.freight += r.freight; m.cost += r.cost; m.profit += r.profit;
    });

    Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, m]) => {
      const label = new Date(key + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const row: (string | number)[] = [];
      if (cols.has("month")) row.push(label);
      if (cols.has("invoices")) row.push(m.invoices);
      if (cols.has("tons")) row.push(+m.tons.toFixed(3));
      if (cols.has("revenue")) row.push(+m.revenue.toFixed(2));
      if (cols.has("costNoFreight")) row.push(+m.costNoFreight.toFixed(2));
      if (cols.has("freight")) row.push(+m.freight.toFixed(2));
      if (cols.has("totalCost")) row.push(+m.cost.toFixed(2));
      if (cols.has("profit")) row.push(+m.profit.toFixed(2));
      if (cols.has("margin")) row.push(+(m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0).toFixed(2));
      if (cols.has("avgSell")) row.push(+(m.tons > 0 ? m.revenue / m.tons : 0).toFixed(2));
      if (cols.has("avgBuy")) row.push(+(m.tons > 0 ? m.costNoFreight / m.tons : 0).toFixed(2));
      if (cols.has("marginTon")) row.push(+(m.tons > 0 ? m.profit / m.tons : 0).toFixed(2));
      sheetData.push(row);
    });
  }

  // ── P&L by Customer / Supplier ────────────────────────────────────────────
  else {
    const isClient = tab === "pl-customer";
    sheetName = isClient ? "P&L by Customer" : "P&L by Supplier";
    const nameKey = isClient ? "clientName" : "supplierName";
    const payKey = isClient ? "customerPaymentStatus" : "supplierPaymentStatus";
    const colLabels: Record<string, string> = isClient ? {
      client: "Client", invoices: "Invoices", tons: "Tons",
      revenue: "Revenue", costNoFreight: "Cost (ex-freight)", freight: "Freight",
      totalCost: "Total Cost", profit: "Profit", margin: "Margin %",
      avgSell: "Avg Sell/TN", avgBuy: "Avg Buy/TN", marginTon: "Margin/TN",
      receivable: "Receivable", paidInv: "Paid Inv.", unpaidInv: "Unpaid Inv.", transport: "Transport",
    } : {
      supplier: "Supplier", invoices: "Invoices", tons: "Tons",
      revenue: "Revenue", costNoFreight: "Cost (ex-freight)", freight: "Freight",
      totalCost: "Total Cost", profit: "Profit", margin: "Margin %",
      avgBuy: "Avg Buy/TN", marginTon: "Margin/TN",
      payable: "Payable", paidInv: "Paid Inv.", unpaidInv: "Unpaid Inv.", transport: "Transport",
    };
    sheetData = [Object.keys(colLabels).filter((k) => cols.has(k)).map((k) => colLabels[k])];

    const entityMap = new Map<string, { invoices: number; tons: number; revenue: number; costNoFreight: number; freight: number; cost: number; profit: number; receivable: number; paidInv: number; unpaidInv: number; transports: Record<string, number> }>();
    data.forEach((r) => {
      const name = (r as Record<string, string>)[nameKey];
      if (!entityMap.has(name)) entityMap.set(name, { invoices: 0, tons: 0, revenue: 0, costNoFreight: 0, freight: 0, cost: 0, profit: 0, receivable: 0, paidInv: 0, unpaidInv: 0, transports: {} });
      const e = entityMap.get(name)!;
      e.invoices += 1; e.tons += r.quantityTons; e.revenue += r.revenue;
      e.costNoFreight += r.costNoFreight; e.freight += r.freight; e.cost += r.cost; e.profit += r.profit;
      if ((r as Record<string, string>)[payKey] === "paid") e.paidInv += 1;
      else { e.unpaidInv += 1; e.receivable += r.revenue; }
      e.transports[r.transportType] = (e.transports[r.transportType] || 0) + r.quantityTons;
    });

    Array.from(entityMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([name, e]) => {
      const margin = e.revenue > 0 ? (e.profit / e.revenue) * 100 : 0;
      const transportStr = Object.entries(e.transports).sort((a, b) => b[1] - a[1]).map(([t, tons]) => `${t} ${e.tons > 0 ? ((tons / e.tons) * 100).toFixed(0) : 0}%`).join(", ");
      const row: (string | number)[] = [];
      if (cols.has("client") || cols.has("supplier")) row.push(name);
      if (cols.has("invoices")) row.push(e.invoices);
      if (cols.has("tons")) row.push(+e.tons.toFixed(3));
      if (cols.has("revenue")) row.push(+e.revenue.toFixed(2));
      if (cols.has("costNoFreight")) row.push(+e.costNoFreight.toFixed(2));
      if (cols.has("freight")) row.push(+e.freight.toFixed(2));
      if (cols.has("totalCost")) row.push(+e.cost.toFixed(2));
      if (cols.has("profit")) row.push(+e.profit.toFixed(2));
      if (cols.has("margin")) row.push(+margin.toFixed(2));
      if (cols.has("avgSell")) row.push(+(e.tons > 0 ? e.revenue / e.tons : 0).toFixed(2));
      if (cols.has("avgBuy")) row.push(+(e.tons > 0 ? e.costNoFreight / e.tons : 0).toFixed(2));
      if (cols.has("marginTon")) row.push(+(e.tons > 0 ? e.profit / e.tons : 0).toFixed(2));
      if (cols.has("receivable") || cols.has("payable")) row.push(+e.receivable.toFixed(2));
      if (cols.has("paidInv")) row.push(e.paidInv);
      if (cols.has("unpaidInv")) row.push(e.unpaidInv);
      if (cols.has("transport")) row.push(transportStr);
      sheetData.push(row);
    });
  }

  // Build workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Auto-size columns
  const colWidths = sheetData[0]?.map((_, ci) =>
    Math.min(50, Math.max(10, ...sheetData.map((row) => String(row[ci] ?? "").length + 2)))
  ) ?? [];
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="BZA_${sheetName.replace(/ /g, "_")}.xlsx"`,
    },
  });
}
