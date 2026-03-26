"use client";

import { useState } from "react";

const columnGroups = [
  {
    group: "Purchase Order",
    columns: [
      { key: "poNumber", label: "PO #", default: true },
      { key: "poDate", label: "PO Date", default: true },
      { key: "clientName", label: "Client", default: true },
      { key: "clientPoNumber", label: "Client PO", default: true },
      { key: "supplierName", label: "Supplier", default: true },
    ],
  },
  {
    group: "Certificaciones FSC/PEFC",
    columns: [
      { key: "licenseFsc", label: "License Number", default: true },
      { key: "chainOfCustody", label: "Chain of Custody #", default: true },
      { key: "inputClaim", label: "Input (Claim)", default: true },
      { key: "outputClaim", label: "Output (Claim)", default: true },
    ],
  },
  {
    group: "Invoice / Shipment",
    columns: [
      { key: "invoiceNumber", label: "Invoice #", default: true },
      { key: "item", label: "Item / Description", default: true },
      { key: "quantityTons", label: "Quantity (TN)", default: true },
      { key: "unit", label: "Unit", default: false },
      { key: "shipmentDate", label: "Ship Date", default: true },
      { key: "vehicleId", label: "Vehicle ID", default: false },
      { key: "blNumber", label: "BL Number", default: false },
    ],
  },
  {
    group: "Prices & Financials",
    columns: [
      { key: "sellPrice", label: "Sell Price", default: true },
      { key: "totalInvoice", label: "Invoice Total", default: true },
      { key: "buyPrice", label: "Buy Price", default: true },
      { key: "totalCost", label: "Total Cost", default: true },
      { key: "profit", label: "Profit", default: true },
      { key: "usesFactoring", label: "Factoring", default: false },
    ],
  },
  {
    group: "Status & Payments",
    columns: [
      { key: "customerPaymentStatus", label: "Client Status", default: true },
      { key: "supplierPaymentStatus", label: "Supplier Status", default: false },
      { key: "shipmentStatus", label: "Shipment Status", default: false },
      { key: "invoiceDate", label: "Invoice Date", default: false },
      { key: "paymentTermsDays", label: "Terms (days)", default: false },
      { key: "dueDate", label: "Due Date", default: false },
      { key: "customerPaidDate", label: "Client Paid Date", default: false },
      { key: "supplierPaidDate", label: "Supplier Paid Date", default: false },
    ],
  },
  {
    group: "Terms & Transport",
    columns: [
      { key: "terms", label: "Incoterms", default: true },
      { key: "transportType", label: "Transport Type", default: true },
      { key: "product", label: "Product", default: false },
      { key: "salesDocument", label: "Sales Document", default: false },
      { key: "billingDocument", label: "Billing Document", default: false },
      { key: "supplierInvoiceNumber", label: "Supplier Invoice #", default: false },
      { key: "notes", label: "Notes", default: false },
    ],
  },
];

// Preset templates
const presets = {
  audit: {
    name: "FSC/PEFC Audit",
    description: "Format for certification audits",
    columns: [
      "poNumber", "poDate", "invoiceNumber", "clientName", "clientPoNumber",
      "licenseFsc", "chainOfCustody", "inputClaim", "outputClaim",
      "supplierName", "quantityTons", "unit", "item", "sellPrice",
      "totalInvoice", "buyPrice", "totalCost", "profit",
      "shipmentDate", "customerPaymentStatus", "terms", "transportType",
    ],
  },
  financial: {
    name: "Financial Report",
    description: "Revenue, costs, profit per invoice",
    columns: [
      "poNumber", "invoiceNumber", "clientName", "supplierName",
      "quantityTons", "sellPrice", "totalInvoice", "buyPrice",
      "totalCost", "profit", "customerPaymentStatus", "supplierPaymentStatus",
      "shipmentDate",
    ],
  },
  tracking: {
    name: "Shipment Tracking",
    description: "For tracking vehicles and shipments",
    columns: [
      "poNumber", "invoiceNumber", "clientName", "clientPoNumber",
      "quantityTons", "item", "vehicleId", "blNumber",
      "shipmentDate", "shipmentStatus", "terms", "transportType",
      "salesDocument", "billingDocument",
    ],
  },
  full: {
    name: "Full Report",
    description: "All available columns",
    columns: columnGroups.flatMap((g) => g.columns.map((c) => c.key)),
  },
};

export default function ExportPage() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(columnGroups.flatMap((g) => g.columns.filter((c) => c.default).map((c) => c.key)))
  );
  const [loading, setLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");

  function toggleColumn(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function toggleGroup(group: typeof columnGroups[0]) {
    const allSelected = group.columns.every((c) => selected.has(c.key));
    const next = new Set(selected);
    group.columns.forEach((c) => {
      if (allSelected) next.delete(c.key);
      else next.add(c.key);
    });
    setSelected(next);
  }

  function applyPreset(preset: keyof typeof presets) {
    setSelected(new Set(presets[preset].columns));
  }

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: Array.from(selected),
          filters: { year: yearFilter },
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BZA_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select the columns to include in the report. Use presets for common formats.
        </p>
      </div>

      {/* Presets */}
      <div>
        <p className="text-sm font-medium mb-2">Presets</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key as keyof typeof presets)}
              className="border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <span className="font-medium">{preset.name}</span>
              <span className="text-muted-foreground ml-1">— {preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Year filter */}
      <div>
        <p className="text-sm font-medium mb-2">Filter by Year</p>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
        >
          <option value="all">All years</option>
          <option value="2022">2022</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
        </select>
      </div>

      {/* Column selector */}
      <div className="space-y-4">
        <p className="text-sm font-medium">
          Selected columns: <span className="text-primary">{selected.size}</span>
        </p>

        {columnGroups.map((group) => {
          const allChecked = group.columns.every((c) => selected.has(c.key));
          const someChecked = group.columns.some((c) => selected.has(c.key));

          return (
            <div key={group.group} className="bg-white rounded-md shadow-sm p-4">
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked && !allChecked;
                  }}
                  onChange={() => toggleGroup(group)}
                  className="rounded"
                />
                <span className="text-sm font-semibold">{group.group}</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ml-6">
                {group.columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Export button */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleExport}
          disabled={loading || selected.size === 0}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium text-sm shadow-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Exporting..." : `Download Excel (${selected.size} columns)`}
        </button>
      </div>
    </div>
  );
}
