"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importExcelData } from "@/server/import-action";

type ParsedRow = {
  poNumber: string;
  poDate: string;
  invoiceNumber: string;
  customer: string;
  customerPO: string;
  quantityTons: number;
  supplier: string;
  sellPrice: number;
  buyPrice: number;
  shipmentDate: string;
  status: string;
  item: string;
  terms: string;
  transportType: string;
};

export default function ImportPage() {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult("");
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
        }) as unknown as unknown[][];

        const rows: ParsedRow[] = [];

        // Skip header row (index 0), start from row 1
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !Array.isArray(row)) continue;

          // Column mapping: B=1, C=2, D=3, G=6, H=7, M=12, P=15, Q=16, S=18, AB=27, AC=28, AD=29, AE=30, AF=31
          const customer = String(row[6] || "").trim();
          const poNumber = String(row[1] || "").trim();

          // Skip TOTAL rows and empty rows
          if (customer === "TOTAL" || customer === "") continue;
          if (!poNumber) continue;

          const poDateRaw = row[2];
          let poDate = "";
          if (typeof poDateRaw === "number") {
            // Excel serial date
            const parsed = XLSX.SSF.parse_date_code(poDateRaw);
            if (parsed) {
              poDate = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
            }
          } else if (poDateRaw) {
            poDate = String(poDateRaw);
          }

          const shipmentDateRaw = row[27];
          let shipmentDate = "";
          if (typeof shipmentDateRaw === "number") {
            const parsed = XLSX.SSF.parse_date_code(shipmentDateRaw);
            if (parsed) {
              shipmentDate = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
            }
          } else if (shipmentDateRaw) {
            shipmentDate = String(shipmentDateRaw);
          }

          // Map transport type
          const transportRaw = String(row[31] || "").trim().toLowerCase();
          let transportType = "";
          if (transportRaw.includes("ffcc") || transportRaw.includes("ferro") || transportRaw.includes("rail")) {
            transportType = "ffcc";
          } else if (transportRaw.includes("ship") || transportRaw.includes("marit") || transportRaw.includes("barco")) {
            transportType = "ship";
          } else if (transportRaw.includes("truck") || transportRaw.includes("cami")) {
            transportType = "truck";
          }

          rows.push({
            poNumber,
            poDate,
            invoiceNumber: String(row[3] || "").trim(),
            customer,
            customerPO: String(row[7] || "").trim(),
            quantityTons: Number(row[12]) || 0,
            supplier: String(row[15] || "").trim(),
            sellPrice: Number(row[16]) || 0,
            buyPrice: Number(row[18]) || 0,
            shipmentDate,
            status: String(row[28] || "").trim(),
            item: String(row[29] || "").trim(),
            terms: String(row[30] || "").trim(),
            transportType,
          });
        }

        setParsedData(rows);
      } catch (err) {
        setError("Error parsing the file. Please verify it is a valid Excel file.");
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
  }

  function handleImport() {
    if (parsedData.length === 0) return;

    startTransition(async () => {
      try {
        const importResult = await importExcelData(parsedData);
        setResult(
          `Import successful: ${importResult.clients} clients, ${importResult.suppliers} suppliers, ${importResult.purchaseOrders} purchase orders, ${importResult.invoices} invoices created.`
        );
        setParsedData([]);
        setFileName("");
      } catch (err) {
        setError(`Import error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    });
  }

  // Group by PO for summary
  const poGroups = parsedData.reduce((acc, row) => {
    if (!acc[row.poNumber]) {
      acc[row.poNumber] = { customer: row.customer, supplier: row.supplier, invoices: 0, tons: 0 };
    }
    acc[row.poNumber].invoices++;
    acc[row.poNumber].tons += row.quantityTons;
    return acc;
  }, {} as Record<string, { customer: string; supplier: string; invoices: number; tons: number }>);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Excel</h1>

      {/* File Upload */}
      <div className="bg-white rounded-md shadow-sm p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Select an Excel file with the expected format. Columns must match the layout:
          B=PO#, C=Date, D=Invoice#, G=Client, H=Client PO, M=Quantity(TN), P=Supplier, Q=Sell Price,
          S=Buy Price, AB=Ship Date, AC=Status, AD=Item, AE=Terms, AF=Transport Type.
        </p>

        <div className="flex items-center gap-4">
          <label className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Select File
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        </div>
      </div>

      {/* Error / Result Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
          {result}
        </div>
      )}

      {/* Preview */}
      {parsedData.length > 0 && (
        <>
          {/* Summary by PO */}
          <div className="bg-white rounded-md shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Summary: {parsedData.length} rows, {Object.keys(poGroups).length} POs
              </h3>
              <button
                onClick={handleImport}
                disabled={isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? "Importing..." : "Import Data"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">PO #</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Supplier</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Invoices</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tons Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(poGroups).map(([poNumber, group]) => (
                    <tr key={poNumber}>
                      <td className="p-3 text-sm border-t border-border font-medium">{poNumber}</td>
                      <td className="p-3 text-sm border-t border-border">{group.customer}</td>
                      <td className="p-3 text-sm border-t border-border">{group.supplier}</td>
                      <td className="p-3 text-sm border-t border-border text-right">{group.invoices}</td>
                      <td className="p-3 text-sm border-t border-border text-right">{group.tons.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Preview Table */}
          <div className="bg-white rounded-md shadow-sm">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Detailed Preview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">PO #</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Invoice</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Client</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Supplier</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Tons</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Sell</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Buy</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Item</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 50).map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-sm border-t border-border">{row.poNumber}</td>
                      <td className="p-3 text-sm border-t border-border">{row.poDate}</td>
                      <td className="p-3 text-sm border-t border-border">{row.invoiceNumber}</td>
                      <td className="p-3 text-sm border-t border-border">{row.customer}</td>
                      <td className="p-3 text-sm border-t border-border">{row.supplier}</td>
                      <td className="p-3 text-sm border-t border-border text-right">{row.quantityTons}</td>
                      <td className="p-3 text-sm border-t border-border text-right">${row.sellPrice}</td>
                      <td className="p-3 text-sm border-t border-border text-right">${row.buyPrice}</td>
                      <td className="p-3 text-sm border-t border-border">{row.item}</td>
                      <td className="p-3 text-sm border-t border-border">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
                  Showing 50 of {parsedData.length} rows.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
