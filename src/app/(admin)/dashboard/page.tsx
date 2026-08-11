export const dynamic = "force-dynamic";

import { getDashboardKPIs, getInvoices } from "@/server/queries";
import { db } from "@/db";
import { scheduledReports, purchaseOrders, invoices, supplierPayments, customerPayments, clients, suppliers, bankAccounts, bankTransactions } from "@/db/schema";
import { eq, and, lt, like, sql } from "drizzle-orm";
import { getCreditInsuranceData } from "@/server/credit-insurance";
import { DashboardApp, type Row } from "@/components/dashboard-app";

function parseDestination(terms: string | null | undefined): string {
  const t = terms || "";
  if (t.includes("El Paso")) return "El Paso";
  if (t.includes("Laredo")) return "Laredo";
  if (t.includes("Eagle Pass")) return "Eagle Pass";
  if (t.includes("Manzanillo")) return "Manzanillo";
  if (t.includes("Veracruz")) return "Veracruz";
  return "";
}

function parseTransport(t: string | null | undefined): Row["transport"] {
  return t === "ffcc" ? "Rail" : t === "ship" ? "Ocean" : t === "truck" ? "Truck" : "Other";
}

export default async function DashboardPage() {
  const [kpis, allInvoices, creditInsurance] = await Promise.all([
    getDashboardKPIs(),
    getInvoices(),
    getCreditInsuranceData(),
  ]);

  // Accounts payable: everything shipped (invoiced cost) vs everything paid, per supplier.
  const [supplierCosts, supplierPaid] = await Promise.all([
    db.select({
      supplierId: purchaseOrders.supplierId,
      totalCost: sql<number>`coalesce(sum(${invoices.quantityTons} * coalesce(${invoices.buyPriceOverride}, ${purchaseOrders.buyPrice})), 0)`,
    }).from(invoices)
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .groupBy(purchaseOrders.supplierId),
    db.select({
      supplierId: supplierPayments.supplierId,
      totalPaid: sql<number>`coalesce(sum(${supplierPayments.amountUsd}), 0)`,
    }).from(supplierPayments).groupBy(supplierPayments.supplierId),
  ]);
  const supplierBalanceNet = supplierCosts.reduce((sum, c) => {
    const paid = supplierPaid.find((p) => p.supplierId === c.supplierId)?.totalPaid ?? 0;
    return sum + (Number(c.totalCost) - Number(paid));
  }, 0);
  const supplierBalance = Math.abs(supplierBalanceNet);

  // Pending scheduled reports
  const pendingSchedules = await db
    .select({ id: scheduledReports.id, sendDate: scheduledReports.sendDate })
    .from(scheduledReports)
    .where(eq(scheduledReports.status, "pending"));
  const todayStr = new Date().toISOString().split("T")[0];
  const overdueReportsCount = pendingSchedules.filter((s) => s.sendDate <= todayStr).length;

  // Bank cash: current balance per account = opening balance + net of its transactions.
  const [bankRows, txnSums] = await Promise.all([
    db.select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      bank: bankAccounts.bank,
      accountNumberMasked: bankAccounts.accountNumberMasked,
      accountType: bankAccounts.accountType,
      openingBalance: bankAccounts.openingBalance,
      isActive: bankAccounts.isActive,
    }).from(bankAccounts),
    db.select({
      bankAccountId: bankTransactions.bankAccountId,
      net: sql<number>`coalesce(sum(${bankTransactions.amount}), 0)`,
    }).from(bankTransactions).groupBy(bankTransactions.bankAccountId),
  ]);
  const bankAccountsData = bankRows
    .filter((a) => a.isActive)
    .map((a) => ({
      id: a.id,
      name: a.name,
      bank: a.bank,
      accountNumberMasked: a.accountNumberMasked,
      accountType: a.accountType,
      currentBalance: Number(a.openingBalance) + Number(txnSums.find((t) => t.bankAccountId === a.id)?.net ?? 0),
    }))
    .sort((a, b) => b.currentBalance - a.currentBalance);
  const totalCash = bankAccountsData.reduce((sum, a) => sum + a.currentBalance, 0);

  // Monthly accounting — real cash this month: itemized collected, paid, and expenses (OpEx).
  const curMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [collectedItems, paidItems, expenseItems] = await Promise.all([
    db.select({ name: clients.name, date: customerPayments.paymentDate, method: customerPayments.paymentMethod, amount: customerPayments.amount })
      .from(customerPayments).leftJoin(clients, eq(customerPayments.clientId, clients.id))
      .where(like(customerPayments.paymentDate, `${curMonthStr}%`)),
    db.select({ name: suppliers.name, date: supplierPayments.paymentDate, amount: supplierPayments.amountUsd })
      .from(supplierPayments).leftJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .where(like(supplierPayments.paymentDate, `${curMonthStr}%`)),
    db.select({ vendor: bankTransactions.vendorName, sub: bankTransactions.subcategory, date: bankTransactions.transactionDate, amount: bankTransactions.amount })
      .from(bankTransactions)
      .where(and(eq(bankTransactions.category, "OpEx"), lt(bankTransactions.amount, 0), like(bankTransactions.transactionDate, `${curMonthStr}%`))),
  ]);
  const collectedList = collectedItems
    .map((r) => ({ label: r.name ?? "Customer", sub: `${r.date}${r.method ? ` · ${r.method.replace(/_/g, " ")}` : ""}`, value: Number(r.amount) }))
    .sort((a, b) => b.value - a.value);
  const paidList = paidItems
    .map((r) => ({ label: r.name ?? "Supplier", sub: r.date, value: Number(r.amount ?? 0) }))
    .sort((a, b) => b.value - a.value);
  const expenseList = expenseItems
    .map((r) => ({ label: r.vendor ?? r.sub ?? "Expense", sub: r.date, value: Math.abs(Number(r.amount)) }))
    .sort((a, b) => b.value - a.value);
  const accounting = {
    month: curMonthStr,
    collected: collectedList.reduce((n, x) => n + x.value, 0),
    paid: paidList.reduce((n, x) => n + x.value, 0),
    expenses: expenseList.reduce((n, x) => n + x.value, 0),
    collectedItems: collectedList,
    paidItems: paidList,
    expenseItems: expenseList,
  };

  // Serializable per-invoice rows — same data, computed client-side per period.
  const rows: Row[] = allInvoices.map((r) => ({
    id: r.invoice.id,
    invoiceNumber: r.invoice.invoiceNumber ?? "",
    clientName: r.clientName ?? "",
    supplierName: r.supplierName ?? "",
    product: r.product ?? r.invoice.item ?? "",
    transport: parseTransport(r.transportType),
    destination: parseDestination(r.terms),
    tons: r.invoice.quantityTons,
    sellPrice: r.invoice.sellPriceOverride ?? r.poSellPrice ?? 0,
    buyPrice: r.invoice.buyPriceOverride ?? r.poBuyPrice ?? 0,
    freight: r.invoice.freightCost || 0,
    shipmentDate: r.invoice.shipmentDate ?? null,
    shipmentStatus: r.invoice.shipmentStatus ?? "",
    custUnpaid: r.invoice.customerPaymentStatus === "unpaid",
    supUnpaid: r.invoice.supplierPaymentStatus === "unpaid",
    dueDate: r.invoice.dueDate ?? null,
  }));

  return (
    <DashboardApp
      rows={rows}
      supplierBalance={supplierBalance}
      supplierBalanceNet={supplierBalanceNet}
      activePOs={kpis.activePOs}
      creditInsurance={creditInsurance}
      overdueReportsCount={overdueReportsCount}
      bankAccounts={bankAccountsData}
      totalCash={totalCash}
      accounting={accounting}
    />
  );
}
