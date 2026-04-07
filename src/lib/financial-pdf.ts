// This file intentionally left minimal — PDF logic lives in each route file
// to avoid Next.js bundler issues with pdfkit require() in shared modules.
// See: src/app/api/reports/financial/pdf/route.ts (buildPdf inline)
//      src/app/api/reports/financial/send/route.ts (buildPdf inline)

export const AR_DEFAULT_COLS = [
  "invoiceNumber","clientName","product","date","dueDate","days","tons","amount","custPayment"
];

export type PdfRow = {
  invoiceNumber: string;
  clientName: string;
  supplierName: string;
  poNumber: string;
  invoiceDate: string | null;
  shipmentDate: string | null;
  dueDate: string | null;
  quantityTons: number;
  revenue: number;
  cost: number;
  profit: number;
  customerPaymentStatus: string;
  shipmentStatus: string;
  destination: string | null;
  product: string | null;
};
