import Link from "next/link";
import { getPurchaseOrders, getClients, getSuppliers } from "@/server/queries";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import { POListActions } from "@/components/po-form";
import { POStatusToggle } from "@/components/po-status-toggle";

const tabs = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const [allPOs, clientsList, suppliersList] = await Promise.all([
    getPurchaseOrders(),
    getClients(),
    getSuppliers(),
  ]);

  const filterStatus = params.status || "";

  const counts: Record<string, number> = {
    "": allPOs.length,
    active: allPOs.filter((r) => r.po.status === "active").length,
    completed: allPOs.filter((r) => r.po.status === "completed").length,
    cancelled: allPOs.filter((r) => r.po.status === "cancelled").length,
  };

  let poRows = allPOs;
  if (filterStatus) {
    poRows = poRows.filter((r) => r.po.status === filterStatus);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>

      {/* Status tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map((tab) => {
          const isActive = filterStatus === tab.key;
          if (tab.key === "cancelled" && counts.cancelled === 0) return null;
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/purchase-orders?status=${tab.key}` : "/purchase-orders"}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} <span className="text-xs opacity-70">({counts[tab.key]})</span>
            </Link>
          );
        })}
      </div>

      <POListActions clients={clientsList} suppliers={suppliersList} />

      <div className="bg-white rounded-md shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">PO #</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Supplier</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Product</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Sell</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Buy</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Inv.</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tons</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Revenue</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Profit</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {poRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-sm text-muted-foreground">
                    No purchase orders found.
                  </td>
                </tr>
              )}
              {poRows.map((row) => {
                const revenue = row.totalRevenue;
                const cost = row.totalCost;
                const profit = revenue - cost;

                return (
                  <tr key={row.po.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-sm border-t border-border">
                      <Link href={`/purchase-orders/${row.po.id}`} className="text-primary font-medium hover:underline">
                        {row.po.poNumber}
                      </Link>
                    </td>
                    <td className="p-3 text-sm border-t border-border">{formatDate(row.po.poDate)}</td>
                    <td className="p-3 text-sm border-t border-border">{row.clientName || "-"}</td>
                    <td className="p-3 text-sm border-t border-border">{row.supplierName || "-"}</td>
                    <td className="p-3 text-sm border-t border-border">{row.po.product}</td>
                    <td className="p-3 text-sm border-t border-border text-right">{formatCurrency(row.po.sellPrice)}</td>
                    <td className="p-3 text-sm border-t border-border text-right">{formatCurrency(row.po.buyPrice)}</td>
                    <td className="p-3 text-sm border-t border-border text-right">{row.invoiceCount}</td>
                    <td className="p-3 text-sm border-t border-border text-right">{formatNumber(row.totalTons, 1)}</td>
                    <td className="p-3 text-sm border-t border-border text-right">{formatCurrency(revenue)}</td>
                    <td className="p-3 text-sm border-t border-border text-right font-medium">
                      <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(profit)}
                      </span>
                    </td>
                    <td className="p-3 text-sm border-t border-border">
                      <POStatusToggle poId={row.po.id} currentStatus={row.po.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
